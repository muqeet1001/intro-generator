// Calls the SVTouch Lovable app's public MCP server (tool: generate_intros)
// over MCP streamable HTTP (JSON-RPC). Generation runs on Lovable's AI gateway
// and is billed to the Lovable workspace's credits — no local API key needed.
import { config } from "../config.js";

function parseMcpBody(raw, contentType) {
  // Streamable HTTP may answer as plain JSON or as an SSE stream of `data:` lines.
  if (contentType.includes("text/event-stream")) {
    const events = raw
      .split(/\n\n/)
      .map((chunk) => chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join(""))
      .filter(Boolean);
    for (const e of events.reverse()) {
      try {
        const json = JSON.parse(e);
        if (json.result || json.error) return json;
      } catch {}
    }
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function rpc(url, body, sessionId) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const raw = await res.text();
  if (!res.ok) throw new Error(`MCP ${res.status}: ${raw.slice(0, 200)}`);
  return {
    json: parseMcpBody(raw, res.headers.get("content-type") || ""),
    sessionId: res.headers.get("mcp-session-id") || sessionId,
  };
}

// Generate the 4 intros via the remote MCP tool. Returns { intros, fetched }.
export async function generateViaLovableMcp(data) {
  const url = config.lovableMcpUrl;
  if (!url) throw new Error("LOVABLE_MCP_URL not configured");

  // 1. initialize (some servers are stateless and ignore this; harmless either way)
  let sessionId;
  try {
    const init = await rpc(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "monster-intro-generator", version: "1.0.0" },
      },
    });
    sessionId = init.sessionId;
    if (init.json?.error) throw new Error(init.json.error.message || "initialize failed");
    await rpc(url, { jsonrpc: "2.0", method: "notifications/initialized" }, sessionId).catch(() => {});
  } catch (e) {
    // Stateless servers may reject initialize — try the tool call anyway.
    console.warn("[lovable-mcp] initialize skipped:", e.message);
  }

  // 2. tools/call generate_intros
  const args = {
    name: data.name,
    ...(data.role && { role: data.role }),
    ...(data.company && { company: data.company }),
    ...(data.city && { city: data.city }),
    ...(data.sector && { sector: data.sector }),
    ...(data.bio && { bio: data.bio }),
    ...(data.can_help_with && { can_help_with: data.can_help_with }),
    ...(data.looking_for && { looking_for: data.looking_for }),
    ...(data.linkedin?.length && { linkedin: data.linkedin.slice(0, 2) }),
    ...(data.website?.length && { website: data.website.slice(0, 2) }),
    ...(data.email && { email: data.email }),
    ...(data.phone && { phone: data.phone }),
  };

  const call = await rpc(
    url,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "generate_intros", arguments: args } },
    sessionId
  );
  if (!call.json) throw new Error("MCP returned an unparseable response");
  if (call.json.error) throw new Error(call.json.error.message || "tools/call failed");

  const result = call.json.result || {};
  const intros = result.structuredContent?.intros;
  if (intros?.professional || intros?.friendly || intros?.concise || intros?.storytelling) {
    return { intros, fetched: !!result.structuredContent?.fetched };
  }

  // Fallback: parse the markdown text content ("# Professional\n...")
  const text = (result.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  if (text) {
    const grab = (label) => {
      const m = text.match(new RegExp(`#\\s*${label}\\s*\\n([\\s\\S]*?)(?=\\n#\\s|$)`, "i"));
      return m ? m[1].trim() : "";
    };
    const parsed = {
      professional: grab("Professional"),
      friendly: grab("Friendly"),
      concise: grab("Concise"),
      storytelling: grab("Storytelling"),
    };
    if (parsed.professional || parsed.friendly) return { intros: parsed, fetched: false };
  }
  throw new Error("MCP tool returned no intros");
}
