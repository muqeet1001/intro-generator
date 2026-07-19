import { Router } from "express";
import { z } from "zod";
import { chatCompletion, extractJson } from "../services/ai.js";
import { anthropicChat } from "../services/anthropic.js";
import { fetchUrlText, scrapeUrl } from "../services/fetchUrl.js";
import { lookupProfileByUrl } from "../services/searchProviders.js";
import { config } from "../config.js";
import { getStore } from "../db/leadStore.js";
import { classifyPerson } from "../lib/classify.js";

// Every successful generation is recorded so it shows up in the admin table,
// even if the user never clicks "Email me". Fire-and-forget — a storage
// hiccup must never break the generation response.
async function recordGeneration(data, intros, source) {
  try {
    const store = await getStore();
    await store.insert({
      email: data.email || "",
      name: data.name || "",
      kind: "generated",
      category: classifyPerson(data),
      source,
      linkedin: (data.linkedin || []).filter(Boolean),
      website: (data.website || []).filter(Boolean),
      payload: {
        role: data.role, company: data.company, city: data.city, sector: data.sector,
        phone: data.phone, bio: data.bio,
        can_help_with: data.can_help_with, looking_for: data.looking_for,
      },
      intros,
      emailSent: false,
    });
  } catch (e) {
    console.warn("[generate] could not record generation:", e.message);
  }
}
import { GENERATE_SYSTEM, EXTRACT_SYSTEM, buildFacts } from "../lib/prompts.js";
import { buildContactBlock, appendContact } from "../lib/contactBlock.js";
import { fallbackIntros } from "../lib/fallbackIntros.js";

export const generateRouter = Router();

const urlList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (!v) return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr
      .flatMap((s) => String(s).split(/[\s,]+/))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  });

const socials = z
  .object({
    twitter: z.string().trim().max(200).optional().default(""),
    instagram: z.string().trim().max(200).optional().default(""),
    youtube: z.string().trim().max(200).optional().default(""),
    github: z.string().trim().max(200).optional().default(""),
    other: z.string().trim().max(300).optional().default(""),
  })
  .partial()
  .optional()
  .default({});

const genInput = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(160).optional().default(""),
  company: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  sector: z.string().trim().max(400).optional().default(""),
  email: z.string().trim().max(255).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  whatsapp: z.string().trim().max(40).optional().default(""),
  linkedin: urlList,
  website: urlList,
  socials,
  bio: z.string().trim().max(2000).optional().default(""),
  can_help_with: z.string().trim().max(1000).optional().default(""),
  looking_for: z.string().trim().max(1000).optional().default(""),
  category: z.string().trim().max(60).optional().default(""),
});

const EMPTY = { professional: "", friendly: "", concise: "", storytelling: "" };

// POST /api/generate → { intros, fetched, source }
generateRouter.post("/generate", async (req, res) => {
  let data;
  try {
    data = genInput.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: e?.errors?.[0]?.message || "Invalid input" });
  }

  // Drop non-URL junk from the link fields. Users often type a name into the
  // LinkedIn search box without picking a result, leaving raw text there — that
  // would fail the MCP's url validation and force a template fallback.
  data.linkedin = (data.linkedin || []).filter((u) => /^https?:\/\/\S+\.\S+/i.test(u));
  data.website = (data.website || []).filter((u) => /^https?:\/\/\S+\.\S+/i.test(u));

  // Gather optional reference material from links (best-effort).
  const refs = [];
  let fetched = false;
  for (const url of data.linkedin.slice(0, 2)) {
    const t = await fetchUrlText(url, 3500);
    if (t && t.length > 200) { refs.push(`LinkedIn page text (${url}):\n${t}`); fetched = true; }
  }
  for (const url of data.website.slice(0, 2)) {
    const t = await fetchUrlText(url, 2500);
    if (t && t.length > 200) { refs.push(`Website text (${url}):\n${t}`); fetched = true; }
  }

  const facts = buildFacts(data);
  const userMsg = `Write all four intros now for this person.\n\nFacts:\n${facts}\n\n${
    refs.length ? `Reference material (use as context, do not quote):\n${refs.join("\n\n---\n\n")}` : "No reference material - use only the facts above."
  }\n\nReturn JSON only.`;

  let intros = { ...EMPTY };
  let source = "fallback";

  // Provider chain: Claude (Anthropic) → local Ollama → deterministic template.
  const providers = [];
  if (config.anthropic.apiKey && config.anthropic.baseUrl) {
    providers.push(["claude", () => anthropicChat({ system: GENERATE_SYSTEM, user: userMsg, maxTokens: 2400 })]);
  }
  providers.push(["ollama", () => chatCompletion({ system: GENERATE_SYSTEM, user: userMsg, maxTokens: 2400 })]);

  for (const [name, fn] of providers) {
    try {
      const text = await fn();
      const parsed = extractJson(text) || {};
      const got = {
        professional: String(parsed.professional || "").trim(),
        friendly: String(parsed.friendly || "").trim(),
        concise: String(parsed.concise || "").trim(),
        storytelling: String(parsed.storytelling || "").trim(),
      };
      if (got.professional || got.friendly || got.concise || got.storytelling) {
        intros = got;
        source = name;
        break;
      }
      throw new Error("empty AI result");
    } catch (err) {
      console.warn(`[generate] ${name} failed: ${err.message}`);
    }
  }

  if (source === "fallback") intros = fallbackIntros(data);

  const contact = buildContactBlock(data);
  const withContact = appendContact(intros, contact);
  recordGeneration(data, withContact, source);
  res.json({ intros: withContact, fetched, source });
});

// Instant, deterministic parsing of the search snippet — no AI, no delay.
const SECTOR_MAP = [
  [/fintech|payments?|banking|finance/i, "Fintech"],
  [/\bAI\b|machine learning|\bML\b|artificial intelligence/i, "AI / ML"],
  [/saas|software|cloud/i, "SaaS"],
  [/health|medical|pharma/i, "HealthTech"],
  [/e-?commerce|retail|marketplace/i, "E-commerce"],
  [/edtech|education|learning/i, "EdTech"],
  [/web3|crypto|blockchain/i, "Web3"],
  [/climate|solar|renewable/i, "ClimateTech"],
  [/cyber|security/i, "Cybersecurity"],
  [/logistics|supply chain/i, "Logistics"],
  [/media|content|creator/i, "Media"],
];

function parseSnippet(description) {
  const out = { city: "", bio: "", sector: "" };
  if (!description) return out;
  const segs = description.split(/\s*[·•‧|]\s*/).map((s) => s.trim()).filter(Boolean);
  // City: a short early segment like "Redmond, Washington, United States"
  for (const s of segs.slice(0, 3)) {
    if (/^[A-Za-z .'À-ɏ-]+(,\s*[A-Za-z .'À-ɏ-]+){1,2}$/.test(s) && s.length <= 60) {
      out.city = s.split(",").slice(0, 2).join(",").trim();
      break;
    }
  }
  // Bio: the longest sentence-like segment
  const bioSeg = segs.filter((s) => s.length > 40).sort((a, b) => b.length - a.length)[0] || "";
  out.bio = bioSeg.slice(0, 400);
  for (const [re, label] of SECTOR_MAP) {
    if (re.test(description)) { out.sector = label; break; }
  }
  return out;
}

// Parse a search-result headline like "Jane Rao - Founder & CEO at Nova | LinkedIn"
// into { name, role, company } so we can pre-fill instantly, even without a deep read.
function parseHeadline(title) {
  if (!title) return { name: "", role: "", company: "" };
  const clean = title.replace(/\s*[|(].*$/, "").trim();
  const segs = clean.split(/\s+[-–—]\s+/);
  const name = (segs[0] || "").trim();
  const headline = segs.slice(1).join(" - ").trim();
  let role = headline;
  let company = "";
  const at = headline.split(/\s+at\s+/i);
  if (at.length >= 2) {
    role = at[0].trim();
    company = at.slice(1).join(" at ").replace(/[.,;].*$/, "").trim();
  }
  return { name: name.slice(0, 120), role: role.slice(0, 160), company: company.slice(0, 160) };
}

// POST /api/extract → { ok, fetched, fields|null, reason }
generateRouter.post("/extract", async (req, res) => {
  const linkedin = String(req.body?.linkedin || "").trim();
  const website = String(req.body?.website || "").trim();
  let hintTitle = String(req.body?.hintTitle || "").trim();
  let hintDescription = String(req.body?.hintDescription || "").trim();

  // Auto-detect: a pasted LinkedIn URL with no hints → look the profile up in
  // search results to recover its public headline + snippet.
  if (!hintTitle && /linkedin\.com\/in\//i.test(linkedin)) {
    try {
      const found = await lookupProfileByUrl(linkedin);
      if (found) {
        hintTitle = found.title;
        hintDescription = found.description;
      }
    } catch (e) {
      console.warn("[extract] profile lookup failed:", e.message);
    }
  }

  const hint = parseHeadline(hintTitle);
  const snip = parseSnippet(hintDescription);
  // Baseline from the search result — instant, no AI needed.
  const base = {
    name: hint.name, role: hint.role, company: hint.company,
    city: snip.city, sector: snip.sector,
    bio: snip.bio || hintDescription.slice(0, 400),
    can_help_with: "", looking_for: "",
  };

  const liText = /^https?:\/\//i.test(linkedin) ? await scrapeUrl(linkedin, 6000) : "";
  const webText = /^https?:\/\//i.test(website) ? await scrapeUrl(website, 6000) : "";
  const liOk = !!(liText && liText.length > 200);
  const webOk = !!(webText && webText.length > 200);
  const fetched = liOk || webOk;

  if (!fetched) {
    // LinkedIn pages can't be scraped (blocked industry-wide), but the search
    // result headline + snippet carry name, role, company, city, sector, and a
    // short bio — all parsed deterministically above, so this returns instantly.
    if (base.name || base.bio) {
      return res.json({
        ok: true, fetched: false, fields: base,
        reason: "Auto-filled from your public profile summary. Paste your About text into Bio for richer intros.",
      });
    }
    return res.json({
      ok: false, fetched: false, fields: null,
      reason: "Couldn't read the link automatically. Paste your About text into the Bio field.",
    });
  }

  const parts = [];
  if (hintTitle) parts.push(`Search result headline: ${hintTitle}`);
  if (liOk) parts.push(`LinkedIn page text:\n${liText.slice(0, 8000)}`);
  if (webOk) parts.push(`Website text (${website}):\n${webText.slice(0, 6000)}`);

  try {
    const text = await chatCompletion({ system: EXTRACT_SYSTEM, user: parts.join("\n\n---\n\n"), maxTokens: 1500 });
    const parsed = extractJson(text) || {};
    const pick = (k, max) => (String(parsed[k] || "").trim() || base[k] || "").slice(0, max);
    const fields = {
      name: pick("name", 120), role: pick("role", 160), company: pick("company", 160),
      city: pick("city", 120), sector: pick("sector", 120), bio: pick("bio", 2000),
      can_help_with: pick("can_help_with", 1000), looking_for: pick("looking_for", 1000),
    };
    res.json({ ok: true, fetched, fields, reason: "" });
  } catch (e) {
    if (base.name) return res.json({ ok: true, fetched, fields: base, reason: "" });
    res.json({ ok: false, fetched, fields: null, reason: String(e.message).slice(0, 200) });
  }
});
