// Claude via the Anthropic Messages API. Works with Anthropic directly or a
// compatible gateway (e.g. the Futura Supabase gateway) — set ANTHROPIC_BASE_URL
// to the gateway root and ANTHROPIC_API_KEY to its key.
import { config } from "../config.js";

export async function anthropicChat({ system, user, maxTokens = 2000 }) {
  const url = `${config.anthropic.baseUrl}/v1/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.anthropic.apiKey}`,
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = (json?.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("anthropic returned empty response");
  return text;
}
