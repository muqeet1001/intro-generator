import { useEffect, useMemo, useState, Fragment } from "react";
import svtouchLogo from "./assets/svtouc.png";

// API base: ?api=… (remembered) → localStorage → VITE_API_BASE (build-time) → same origin.
const qsApi = new URLSearchParams(window.location.search).get("api");
if (qsApi) localStorage.setItem("introgen.apiBase", qsApi.replace(/\/$/, ""));
const API_BASE =
  localStorage.getItem("introgen.apiBase") ||
  (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "") ||
  window.location.origin;

const TONES = ["professional", "friendly", "concise", "storytelling"];

export default function App() {
  const [leads, setLeads] = useState([]);
  const [storage, setStorage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("");
  const [openId, setOpenId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/leads`);
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setStorage(data.storage || "");
    } catch (e) {
      setError(
        `Could not reach the API at ${API_BASE} (${e.message}). ` +
          "Open this page with ?api=<your-api-url> to point it at the server."
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const catCounts = useMemo(() => {
    const counts = {};
    for (const l of leads) {
      const c = l.category || "Other";
      counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (activeCat && (l.category || "Other") !== activeCat) return false;
      if (!q) return true;
      const p = l.payload || {};
      return [l.name, l.email, l.category, p.role, p.city, p.sector]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, query, activeCat]);

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const exportJson = () =>
    download(new Blob([JSON.stringify(leads, null, 2)], { type: "application/json" }), "submissions.json");
  const exportCsv = () => {
    const cols = ["createdAt", "kind", "category", "name", "email", "role", "city", "sector", "linkedin"];
    const lines = leads.map((l) => {
      const p = l.payload || {};
      return [l.createdAt, l.kind, l.category, l.name, l.email, p.role, p.city, p.sector, (l.linkedin || []).join(" ")]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });
    download(new Blob([cols.join(",") + "\n" + lines.join("\n")], { type: "text/csv" }), "submissions.csv");
  };

  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="wrap">
      <div className="glass">
        <header>
          <div className="brand">
            <img src={svtouchLogo} alt="SVTouch" />
            <h1>SVTouch Intro Generator — Admin</h1>
            {storage && <span className="badge">{storage} store</span>}
          </div>
          <div className="controls">
            <button className="pill" onClick={load}>Refresh</button>
            <button className="pill" onClick={exportCsv}>Download CSV</button>
            <button className="pill dark" onClick={exportJson}>Export JSON</button>
          </div>
        </header>

        <div className="band">
          <h2>Everyone who used the tool</h2>
          <p>
            {loading ? "Loading…" : `${leads.length} total record${leads.length === 1 ? "" : "s"} · API: ${API_BASE}`}
          </p>
        </div>

        <div className="cats">
          <button className={`cat${activeCat === "" ? " active" : ""}`} onClick={() => setActiveCat("")}>
            All<span className="n">{leads.length}</span>
          </button>
          {catCounts.map(([c, n]) => (
            <button key={c} className={`cat${activeCat === c ? " active" : ""}`}
              onClick={() => setActiveCat(activeCat === c ? "" : c)}>
              {c}<span className="n">{n}</span>
            </button>
          ))}
        </div>

        <div className="search">
          <input placeholder="Filter by name, email, sector…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>When</th><th>Name</th><th>Category</th><th>Email</th><th>Role / City</th>
                <th>Sector</th><th>Type</th><th>LinkedIn</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="loading">Loading…</td></tr>
              ) : error ? (
                <tr><td colSpan={9} className="empty">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="empty">
                  No records{query || activeCat ? " match your filter." : " yet."}
                </td></tr>
              ) : (
                rows.map((l) => {
                  const p = l.payload || {};
                  const isOpen = openId === l.id;
                  return (
                    <Fragment key={l.id}>
                      <tr>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmt(l.createdAt)}</td>
                        <td><strong>{l.name || "—"}</strong></td>
                        <td><span className="badge">{l.category || "Other"}</span></td>
                        <td>{l.email || "—"}</td>
                        <td className="muted">{[p.role, p.city].filter(Boolean).join(" · ") || "—"}</td>
                        <td>{p.sector ? <span className="badge">{p.sector}</span> : "—"}</td>
                        <td>
                          {l.kind === "email_requested"
                            ? <span className="badge blue">emailed</span>
                            : <span className="badge">generated</span>}
                        </td>
                        <td>
                          {(l.linkedin || [])[0]
                            ? <a href={l.linkedin[0]} target="_blank" rel="noreferrer">profile</a>
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button className="view" onClick={() => setOpenId(isOpen ? null : l.id)}>
                            {isOpen ? "Hide" : "View intros"}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={9}>
                            <div className="intros">
                              {TONES.map((t) => (
                                <div key={t} className="intro">
                                  <div className="t">{t}</div>
                                  <p>{(l.intros || {})[t] || "—"}</p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
