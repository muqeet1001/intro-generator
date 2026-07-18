import { useEffect, useMemo, useState, Fragment } from "react";
import svtouchLogo from "./assets/svtouc.png";

// API base, in priority order:
//   1. ?api=…  (remembered in localStorage — lets you repoint without rebuilding)
//   2. VITE_API_BASE  (Vercel build-time env)
//   3. the deployed backend (production default)
//   4. same origin  (dev, where the Vite proxy handles /api)
const PROD_API = "https://intro-generator.onrender.com";
const qsApi = new URLSearchParams(window.location.search).get("api");
if (qsApi) localStorage.setItem("introgen.apiBase", qsApi.replace(/\/$/, ""));
const API_BASE =
  localStorage.getItem("introgen.apiBase") ||
  (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "") ||
  (import.meta.env.PROD ? PROD_API : window.location.origin);

const TONES = ["professional", "friendly", "concise", "storytelling"];
const AUTH_KEY = "introgen.auth"; // "ok" flag once the frontend password matched

// Soft frontend lock. Password comes from a Vercel build-time env var so it
// stays OUT of git. If VITE_ADMIN_PASSWORD isn't set, the admin is open.
// NOTE: this gates the SCREEN only — the API stays open, so it keeps casual
// visitors out but is not real security. Keep the admin URL private.
const GATE_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
const GATE_PASS = import.meta.env.VITE_ADMIN_PASSWORD || "";
const GATED = !!GATE_PASS;

export default function App() {
  // If not gated, we're "authed" immediately. If gated, restore from localStorage.
  const [authed, setAuthed] = useState(() => !GATED || localStorage.getItem(AUTH_KEY) === "ok");
  const [leads, setLeads] = useState([]);
  const [storage, setStorage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("");
  const [openId, setOpenId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Send Basic auth too, so this also works if the API is ever locked server-side.
  const authHeaders = () => {
    const t = localStorage.getItem("introgen.creds");
    return t ? { Authorization: `Basic ${t}` } : {};
  };

  function logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem("introgen.creds");
    setAuthed(!GATED);
    setLeads([]);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/leads`, { headers: authHeaders() });
      if (res.status === 401) { logout(); setError("Session expired — please sign in again."); setLoading(false); return; }
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setStorage(data.storage || "");
    } catch (e) {
      setError(`Could not reach the API at ${API_BASE} (${e.message}).`);
    }
    setLoading(false);
  }

  async function remove(lead) {
    if (!window.confirm(`Delete the record for "${lead.name || lead.email || "this person"}"? This can't be undone.`)) return;
    setDeleting(lead.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/leads/${lead.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setLeads((rows) => rows.filter((r) => r.id !== lead.id)); // optimistic
    } catch (e) {
      alert(e.message);
    }
    setDeleting(null);
  }

  useEffect(() => {
    if (authed) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Client-side password check against the build-time env vars.
  function doLogin(email, password) {
    if (GATE_EMAIL && email.trim().toLowerCase() !== GATE_EMAIL) return "Wrong email or password.";
    if (password !== GATE_PASS) return "Wrong email or password.";
    localStorage.setItem(AUTH_KEY, "ok");
    localStorage.setItem("introgen.creds", btoa(`${email}:${password}`));
    setAuthed(true);
    return "";
  }

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

  // Gate AFTER all hooks so the hook order never changes between renders.
  if (GATED && !authed) return <Login onLogin={doLogin} apiBase={API_BASE} />;

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
            <button className="pill" onClick={logout} title="Sign out">Logout</button>
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
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button className="view" onClick={() => setOpenId(isOpen ? null : l.id)}>
                            {isOpen ? "Hide" : "View intros"}
                          </button>
                          <button className="del" onClick={() => remove(l)} disabled={deleting === l.id} title="Delete record">
                            {deleting === l.id ? "…" : "Delete"}
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


function Login({ onLogin, apiBase }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const msg = await onLogin(email.trim(), password);
    if (msg) setErr(msg);
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <form className="glass login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src={svtouchLogo} alt="SVTouch" />
          <div>
            <h1>SVTouch Intro Generator</h1>
            <p>Admin sign in</p>
          </div>
        </div>
        <label>Email</label>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <label>Password</label>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        {err && <p className="login-err">{err}</p>}
        <button className="pill dark" type="submit" disabled={busy} style={{ width: "100%", padding: "11px", marginTop: "4px" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="login-api">API: {apiBase}</p>
      </form>
    </div>
  );
}
