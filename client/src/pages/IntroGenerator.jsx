import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import SearchAutocomplete from "../components/SearchAutocomplete.jsx";
import svtouchMark from "../assets/svtouch-mark.png";

const SECTORS = [
  "Fintech", "SaaS", "AI / ML", "EdTech", "HealthTech", "E-commerce",
  "ClimateTech", "Web3", "Consumer", "Marketplace", "DeepTech", "Cybersecurity",
];
const MAX_SECTORS = 3;
const CATEGORIES = [
  "Founder", "Job Seeker", "Student", "Investor",
  "Agripreneur", "Developer", "Designer", "Freelancer",
];
const STORAGE_KEY = "monster:intro-generator:v1";
const TONES = [
  { key: "professional", label: "Professional" },
  { key: "friendly", label: "Friendly" },
  { key: "concise", label: "Pitch" },
  { key: "storytelling", label: "Investor-ready" },
];

const EMPTY = {
  name: "", email: "", role: "", company: "", city: "", phone: "", category: "",
  sectors: [], linkedin: "", website: "", bio: "", can_help_with: "", looking_for: "",
};

const inputCls = "glass-input w-full rounded-2xl px-4 py-2.5 text-sm";

// Only treat a link field as a URL — a name typed into the search box that
// wasn't turned into a profile URL must not be sent as a LinkedIn link.
const asUrl = (v) => (/^https?:\/\/\S+\.\S+/i.test((v || "").trim()) ? [v.trim()] : []);

export default function IntroGenerator() {
  const [form, setForm] = useState(EMPTY);
  const [intros, setIntros] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillNote, setAutoFillNote] = useState("");
  const lastExtracted = useRef("");
  const detectTimer = useRef(null);
  const [emailValue, setEmailValue] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [copied, setCopied] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) setForm((f) => ({ ...f, ...saved }));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); } catch {}
  }, [form]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Accept "linkedin.com/in/x", "www.linkedin.com/in/x", or full URLs.
  const normalizeLinkedIn = (v) => {
    const t = v.trim();
    if (/^(www\.)?([\w-]+\.)?linkedin\.com\/in\//i.test(t)) return `https://${t.replace(/^https?:\/\//i, "")}`;
    return t;
  };

  // Auto-detect: as soon as a LinkedIn profile URL lands in the field
  // (pasted or picked), read it and fill the form — no button needed.
  useEffect(() => {
    const url = normalizeLinkedIn(form.linkedin);
    clearTimeout(detectTimer.current);
    if (!/^https?:\/\/([\w-]+\.)?linkedin\.com\/in\/[^/?#]+/i.test(url)) return;
    if (lastExtracted.current === url || autoFilling) return;
    detectTimer.current = setTimeout(() => {
      lastExtracted.current = url;
      if (url !== form.linkedin) set("linkedin", url);
      autoFill(url, "");
    }, 900);
    return () => clearTimeout(detectTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.linkedin]);

  function toggleSector(s) {
    setForm((f) => {
      if (f.sectors.includes(s)) return { ...f, sectors: f.sectors.filter((x) => x !== s) };
      if (f.sectors.length >= MAX_SECTORS) return f;
      return { ...f, sectors: [...f.sectors, s] };
    });
  }

  async function autoFill(linkedinUrl, websiteUrl, hint) {
    setAutoFilling(true);
    setAutoFillNote("");
    try {
      const res = await api.extract(linkedinUrl || form.linkedin, websiteUrl || form.website, hint || {});
      if (res.fields) {
        let filled = 0;
        setForm((f) => {
          const next = { ...f };
          for (const k of ["name", "role", "company", "city", "bio", "can_help_with", "looking_for"]) {
            if (!String(next[k] || "").trim() && res.fields[k]) { next[k] = res.fields[k]; filled++; }
          }
          if (next.sectors.length === 0 && res.fields.sector) {
            const m = SECTORS.find((s) => s.toLowerCase() === res.fields.sector.toLowerCase());
            if (m) { next.sectors = [m]; filled++; }
          }
          return next;
        });
        setAutoFillNote(res.reason || (filled ? `Auto-filled ${filled} field${filled > 1 ? "s" : ""}. Review below.` : "Your form already has values."));
      } else {
        setAutoFillNote(res.reason || "Couldn't read that profile — fill the fields manually.");
      }
    } catch {
      setAutoFillNote("Auto-fill failed — please fill the fields manually.");
    }
    setAutoFilling(false);
  }

  async function onGenerate() {
    if (!form.name.trim()) { setError("Please enter your name."); return; }
    setError("");
    setLoading(true);
    setEmailSent(false);
    try {
      const res = await api.generate({
        name: form.name, role: form.role, company: form.company, city: form.city,
        category: form.category,
        sector: form.sectors.join(", "), email: form.email, phone: form.phone,
        linkedin: asUrl(form.linkedin),
        website: asUrl(form.website),
        bio: form.bio, can_help_with: form.can_help_with, looking_for: form.looking_for,
      });
      setIntros(res.intros);
      setSource(res.source);
      if (form.email && !emailValue) setEmailValue(form.email);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (e) {
      setError(e.message || "Could not generate.");
    }
    setLoading(false);
  }

  function copy(key, text) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
  }
  const shareWhatsApp = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");

  async function onEmailMe() {
    const email = emailValue.trim();
    if (!/.+@.+\..+/.test(email)) { setError("Enter a valid email."); return; }
    setEmailing(true);
    try {
      await api.saveLead({
        email, name: form.name,
        linkedin: asUrl(form.linkedin),
        website: asUrl(form.website),
        payload: { ...form, sector: form.sectors.join(", ") },
        intros,
      });
      setEmailSent(true);
    } catch (e) {
      setError(e.message || "Could not save.");
    }
    setEmailing(false);
  }

  return (
    <div className="grain min-h-screen px-3 py-4 sm:px-6 sm:py-10">
      <div className="blobs" aria-hidden="true">
        <div className="blob blob-1" /><div className="blob blob-2" />
        <div className="blob blob-3" /><div className="blob blob-4" />
      </div>

      <div className="glass reveal relative z-[2] mx-auto max-w-5xl overflow-hidden rounded-4xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <img src={svtouchMark} alt="SVTouch" className="h-9 w-9 rounded-xl shadow-lg" />
            <span className="font-display text-lg font-semibold tracking-tight">SVTouch Intro Generator</span>
          </div>
          <span className="glass-butter inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium">
            <span className="pulse-dot" /> AI Powered
          </span>
        </div>

        {/* Hero */}
        <div className="px-6 pb-12 pt-6 sm:px-10">
          <span className="glass-butter inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium reveal reveal-1">
            Free · No signup · Crafted by AI
          </span>
          <h1 className="reveal reveal-2 mt-5 max-w-3xl font-display text-[2.5rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Founder intros,{" "}
            <span className="italic font-normal" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
              written
            </span>{" "}
            in seconds.
          </h1>
          <p className="reveal reveal-3 mt-4 max-w-xl text-base leading-relaxed text-ink/60 sm:text-lg">
            Paste your LinkedIn — we read it and draft four polished introductions, tuned for WhatsApp groups, pitches, and first emails.
          </p>
        </div>

        {/* Body */}
        <div className="space-y-6 px-4 py-8 sm:px-10">
          <Card step="01" title="About You" subtitle="Start with your LinkedIn — we'll try to read it and pre-fill the rest."
            className="relative z-30">
            <div className="glass-butter relative z-20 rounded-2xl p-4">
              <label className="mb-1.5 block text-sm font-medium">Search LinkedIn or paste URL</label>
              <SearchAutocomplete
                value={form.linkedin}
                onChange={(v) => set("linkedin", v)}
                onSelect={(item) => { lastExtracted.current = item.url; set("linkedin", item.url); autoFill(item.url, "", { title: item.title, description: item.description }); }}
                search={async (q) => (await api.search(q)).results}
                placeholder="Type your name to search, or paste your LinkedIn URL"
                renderItem={(r) => (
                  <>
                    <div className="truncate text-sm font-medium">{r.title || r.url}</div>
                    {r.description && <div className="line-clamp-2 text-xs text-ink/60">{r.description}</div>}
                    <div className="mt-0.5 truncate text-[10px] text-ink/40">{r.url}</div>
                  </>
                )}
              />
              {form.linkedin && /^https?:\/\//i.test(form.linkedin) && (
                <button onClick={() => autoFill()} disabled={autoFilling}
                  className="mt-2 text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-ink">
                  {autoFilling ? "Reading profile…" : "Auto-fill from this link"}
                </button>
              )}
              {autoFilling && <p className="mt-2 flex items-center gap-2 text-xs text-ink/60"><span className="pulse-dot" /> Reading the profile and filling the rest…</p>}
              {!autoFilling && autoFillNote && <p className="mt-2 text-xs text-ink/70">{autoFillNote}</p>}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">I am a…</span>
                <span className="text-xs text-ink/50">optional — auto-detected if blank</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const active = form.category === c;
                  return (
                    <button key={c} type="button" onClick={() => set("category", active ? "" : c)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${active ? "glass-butter" : "glass-btn"}`}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name *"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Email"><input className={inputCls} type="email" placeholder="you@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Role"><input className={inputCls} placeholder="Founder, Engineer…" value={form.role} onChange={(e) => set("role", e.target.value)} /></Field>
              <Field label="Company"><input className={inputCls} value={form.company} onChange={(e) => set("company", e.target.value)} /></Field>
              <Field label="City"><input className={inputCls} placeholder="Bengaluru" value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label="Phone / WhatsApp"><input className={inputCls} placeholder="+91…" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
          </Card>

          <Card step="02" title="What You Do" subtitle="Sectors, a short bio, and what you're offering or seeking.">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Sectors (up to {MAX_SECTORS})</span>
                <span className="text-xs text-ink/50">{form.sectors.length}/{MAX_SECTORS}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map((s) => {
                  const active = form.sectors.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleSector(s)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${active ? "glass-butter" : "glass-btn"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Short bio (optional but recommended)">
              <textarea className={inputCls} rows={3} placeholder="A few sentences about yourself." value={form.bio} onChange={(e) => set("bio", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="What can you help with?"><textarea className={inputCls} rows={3} placeholder="fundraising intros, GTM…" value={form.can_help_with} onChange={(e) => set("can_help_with", e.target.value)} /></Field>
              <Field label="What are you looking for?"><textarea className={inputCls} rows={3} placeholder="seed investors, co-founder…" value={form.looking_for} onChange={(e) => set("looking_for", e.target.value)} /></Field>
            </div>
            <Field label="Website"><input className={inputCls} placeholder="https://your-site.com" value={form.website} onChange={(e) => set("website", e.target.value)} /></Field>
          </Card>

          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          <button onClick={onGenerate} disabled={loading}
            className="glass-btn-dark w-full rounded-full py-4 text-sm font-semibold tracking-wide">
            {loading ? "Writing 4 versions…" : "Generate all 4 tones  →"}
          </button>
        </div>

        {/* Results */}
        {intros && (
          <div id="results" className="space-y-6 px-4 py-10 sm:px-10">
            <div className="text-center">
              <span className="inline-block rounded-full border border-ink/20 px-3 py-1 text-xs font-medium">Your 4 intros</span>
              <h2 className="mt-3 font-display text-3xl font-semibold">Pick the one that sounds like you</h2>
              {source === "fallback" && (
                <p className="mt-2 text-xs text-amber-700">The AI service is busy right now — these are quick drafts. Tap Regenerate in a moment for polished, AI-written versions.</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {TONES.map(({ key, label }) => (
                <div key={key} className="glass-panel rounded-4xl p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold">{label}</h3>
                    <span className="text-xs text-ink/40">{(intros[key] || "").trim().split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                  <textarea
                    className="glass-input min-h-[150px] w-full resize-y rounded-2xl p-3 text-sm"
                    value={intros[key] || ""}
                    onChange={(e) => setIntros((c) => ({ ...c, [key]: e.target.value }))}
                    rows={8}
                  />
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => copy(key, intros[key])}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${copied === key ? "bg-emerald-600 text-white" : "glass-btn-dark"}`}>
                      {copied === key ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => shareWhatsApp(intros[key])}
                      className="glass-btn rounded-full px-4 py-1.5 text-xs font-medium">WhatsApp</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <button onClick={onGenerate} disabled={loading}
                className="glass-btn rounded-full px-5 py-2 text-sm font-medium">
                {loading ? "Regenerating…" : "Regenerate"}
              </button>
            </div>

            <div className="glass-panel mx-auto max-w-xl rounded-4xl p-6">
              {emailSent ? (
                <p className="text-sm">Saved. We've recorded your intros for <strong>{emailValue}</strong>.</p>
              ) : (
                <div className="space-y-3">
                  <p className="font-display font-semibold">Email all 4 to me</p>
                  <p className="text-sm text-ink/60">Saves your details and intros so you can pick later.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input className={inputCls} type="email" placeholder="you@example.com" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} />
                    <button onClick={onEmailMe} disabled={emailing}
                      className="glass-btn-dark whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-medium">
                      {emailing ? "Saving…" : "Email me"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer strip like Enigma */}
        <div className="grid grid-cols-1 gap-3 border-t border-ink/5 px-6 py-6 text-xs text-ink/50 sm:grid-cols-3 sm:px-10">
          <span>AI Powered</span>
          <span className="sm:text-center"><span className="text-ink">Write once,</span> share anywhere</span>
          <span className="sm:text-right">SVTouch Intro Generator</span>
        </div>
      </div>
    </div>
  );
}

function Card({ step, title, subtitle, children, className = "" }) {
  return (
    <div className={`glass-panel reveal rounded-4xl p-6 sm:p-7 ${className}`}>
      <div className="flex items-start gap-4">
        {step && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full glass-butter font-display text-sm font-semibold">
            {step}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink/60">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
