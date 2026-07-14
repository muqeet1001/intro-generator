import { Router } from "express";
import { searchProfiles } from "../services/searchProviders.js";

export const searchRouter = Router();

// POST /api/search → { results, enabled, provider }
searchRouter.post("/search", async (req, res) => {
  const query = String(req.body?.query || "").trim();
  if (query.length < 3) return res.json({ results: [], enabled: true, provider: "none" });
  if (query.length > 120) return res.status(400).json({ error: "Query too long" });

  const { results, provider } = await searchProfiles(query);
  res.json({ results, enabled: true, provider });
});
