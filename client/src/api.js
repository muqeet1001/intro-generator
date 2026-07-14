// Thin API client. All calls go through the Vite proxy to the Express server.
async function post(path, body) {
  const res = await fetch(path, {
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
    const res = await fetch("/api/admin/leads");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to load");
    return json;
  },
};
