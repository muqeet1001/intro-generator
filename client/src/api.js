// Thin API client.
//  - dev: BASE is "" → calls go through the Vite proxy to localhost:5000
//  - production build: BASE = VITE_API_BASE if set, else the deployed backend
// Override anytime by setting VITE_API_BASE in the Vercel env.
const PROD_API = "https://intro-generator.onrender.com";
const BASE = (
  import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? PROD_API : "")
).replace(/\/$/, "");

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export const api = {
  generate: (data) => post("/api/generate", data),
  extract: (linkedin, website, hint = {}) =>
    post("/api/extract", { linkedin, website, hintTitle: hint.title || "", hintDescription: hint.description || "" }),
  search: (query) => post("/api/search", { query }),
  saveLead: (data) => post("/api/leads", data),
  adminLeads: async () => {
    const res = await fetch(BASE + "/api/admin/leads");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to load");
    return json;
  },
};
