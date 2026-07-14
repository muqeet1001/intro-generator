// Shared LinkedIn-profile search: ordered provider chain (Firecrawl → Serper →
// Google CSE → DuckDuckGo scrape). Used by /api/search and by profile
// auto-detection in /api/extract.
import { config } from "../config.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const PROFILE_RE = /^https?:\/\/([\w-]+\.)?linkedin\.com\/in\//i;

const stripTags = (s) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

export function normalizeResults(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const url = (item.url || "").trim();
    if (!url || !PROFILE_RE.test(url)) continue;
    const key = url.split("?")[0].split("#")[0].replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: url.split("?")[0].split("#")[0],
      title: (item.title || "").replace(/\s*[|\-–]\s*LinkedIn.*$/i, "").trim(),
      description: (item.description || "").trim(),
    });
    if (out.length >= 6) break;
  }
  return out;
}

async function firecrawl(query) {
  const r = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { authorization: `Bearer ${config.firecrawlKey}`, "content-type": "application/json" },
    body: JSON.stringify({ query: `${query} ${config.searchSiteFilter}`, limit: 8 }),
  });
  if (!r.ok) throw new Error(`firecrawl ${r.status}`);
  const json = await r.json().catch(() => null);
  const raw = Array.isArray(json?.data) ? json.data : json?.data?.web ?? [];
  return raw.map((x) => ({ url: x?.url, title: x?.title, description: x?.description }));
}

async function serper(query) {
  const r = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": config.serperKey, "content-type": "application/json" },
    body: JSON.stringify({ q: `${query} ${config.searchSiteFilter}`, num: 10 }),
  });
  if (!r.ok) throw new Error(`serper ${r.status}`);
  const json = await r.json();
  return (json.organic || []).map((x) => ({ url: x.link, title: x.title, description: x.snippet }));
}

async function googleCse(query) {
  const u = new URL("https://www.googleapis.com/customsearch/v1");
  u.searchParams.set("key", config.googleKey);
  u.searchParams.set("cx", config.googleCx);
  u.searchParams.set("q", `${query} ${config.searchSiteFilter}`);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`google ${r.status}`);
  const json = await r.json();
  return (json.items || []).map((x) => ({ url: x.link, title: x.title, description: x.snippet }));
}

async function duckduckgo(query) {
  const r = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "user-agent": UA,
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html",
      "accept-language": "en-US,en;q=0.9",
    },
    body: new URLSearchParams({ q: `${query} ${config.searchSiteFilter}` }).toString(),
  });
  if (!r.ok) throw new Error(`ddg ${r.status}`);
  const html = await r.text();
  const results = [];
  const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    let href = m[1];
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (href.startsWith("//")) href = "https:" + href;
    results.push({ url: href, title: stripTags(m[2]), description: "" });
  }
  return results;
}

function providerChain() {
  const chain = [];
  if (config.firecrawlKey) chain.push(["firecrawl", firecrawl]);
  if (config.serperKey) chain.push(["serper", serper]);
  if (config.googleKey && config.googleCx) chain.push(["google", googleCse]);
  chain.push(["duckduckgo", duckduckgo]);
  return chain;
}

// Search for profiles; returns { results, provider }.
export async function searchProfiles(query) {
  for (const [name, fn] of providerChain()) {
    try {
      const results = normalizeResults(await fn(query));
      if (results.length) return { results, provider: name };
    } catch (e) {
      console.warn(`[search] ${name} failed: ${e.message}`);
    }
  }
  return { results: [], provider: "none" };
}

// Given a LinkedIn profile URL, look it up in search results and return its
// { title, description } — the only readable public data for a LinkedIn page.
export async function lookupProfileByUrl(url) {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]);
  const slugKey = slug.toLowerCase();
  const queries = [slug, slug.replace(/-/g, " ").replace(/\d+$/, "").trim()];
  for (const q of queries) {
    if (!q) continue;
    const { results } = await searchProfiles(q);
    const hit =
      results.find((r) => r.url.toLowerCase().includes(`/in/${slugKey}`)) ||
      (results.length === 1 ? results[0] : null);
    if (hit) return hit;
  }
  return null;
}
