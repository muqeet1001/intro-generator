import { Router } from "express";
import { z } from "zod";
import { getStore } from "../db/leadStore.js";
import { classifyPerson } from "../lib/classify.js";

export const leadsRouter = Router();

const introsSchema = z.object({
  professional: z.string().max(6000).default(""),
  friendly: z.string().max(6000).default(""),
  concise: z.string().max(6000).default(""),
  storytelling: z.string().max(6000).default(""),
});

const leadInput = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(120).optional().default(""),
  linkedin: z.array(z.string()).optional().default([]),
  website: z.array(z.string()).optional().default([]),
  payload: z.record(z.any()).optional().default({}),
  intros: introsSchema,
});

// POST /api/leads → save a submission (anyone, no auth)
leadsRouter.post("/leads", async (req, res) => {
  let data;
  try {
    data = leadInput.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: e?.errors?.[0]?.message || "Invalid input" });
  }
  try {
    const store = await getStore();
    const row = await store.insert({
      email: data.email,
      name: data.name || null,
      kind: "email_requested",
      category: classifyPerson(data.payload || {}),
      linkedin: data.linkedin.filter(Boolean),
      website: data.website.filter(Boolean),
      payload: data.payload,
      intros: data.intros,
      emailSent: false,
    });
    res.json({ ok: true, id: row.id });
  } catch (e) {
    console.error("[leads] save failed:", e.message);
    res.status(500).json({ error: "Could not save. Please try again." });
  }
});

// GET /api/admin/leads → list all submissions (no auth, per request)
// Supports ?category=Founder to filter server-side.
leadsRouter.get("/admin/leads", async (req, res) => {
  try {
    const store = await getStore();
    let leads = await store.list();
    // Older records predate the category field — classify them on the fly.
    leads = leads.map((l) =>
      l.category ? l : { ...l, category: classifyPerson({ ...(l.payload || {}), name: l.name }) }
    );
    const category = String(req.query.category || "").trim();
    if (category) leads = leads.filter((l) => l.category === category);
    const counts = {};
    for (const l of leads) counts[l.category] = (counts[l.category] || 0) + 1;
    res.json({ leads, count: leads.length, storage: store.mode, categories: counts });
  } catch (e) {
    console.error("[admin] list failed:", e.message);
    res.status(500).json({ error: "Could not load leads." });
  }
});

// DELETE /api/admin/leads/:id → remove one submission (behind the admin guard)
leadsRouter.delete("/admin/leads/:id", async (req, res) => {
  try {
    const store = await getStore();
    const n = await store.remove(req.params.id);
    if (!n) return res.status(404).json({ error: "Record not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] delete failed:", e.message);
    res.status(500).json({ error: "Could not delete." });
  }
});
