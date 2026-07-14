// Best-effort fetcher for public profile/website URLs. Tolerant of failures —
// callers treat the result as an optional hint (LinkedIn often blocks scrapers).
import { config } from "../config.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Reads a page's text. Prefers Firecrawl (can read LinkedIn, which blocks plain
// scrapers) when a key is configured; otherwise falls back to a plain fetch.
export async function scrapeUrl(url, maxBytes = 6000) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const isLinkedIn = /(^|\.)linkedin\.com\//i.test(url);
  if (config.firecrawlKey) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { authorization: `Bearer ${config.firecrawlKey}`, "content-type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        const md = j?.data?.markdown || j?.markdown || j?.data?.content || "";
        if (md && md.length > 120) return md.slice(0, maxBytes);
      }
    } catch {
      /* fall through */
    }
  }
  // A plain fetch of LinkedIn only returns a login wall — skip it so callers use
  // the search-result hint instead. Non-LinkedIn URLs (websites) fetch normally.
  if (isLinkedIn) return null;
  return fetchUrlText(url, maxBytes);
}

export async function fetchUrlText(url, maxBytes = 4096) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    return stripHtml(html).slice(0, maxBytes);
  } catch {
    return null;
  }
}
