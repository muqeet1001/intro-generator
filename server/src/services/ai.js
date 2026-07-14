// OpenAI-compatible chat completion caller. Defaults to local Ollama.
// Works with: Ollama (/v1), OpenAI, Lovable AI Gateway, or any compatible API.
import { config } from "../config.js";

export async function chatCompletion({ system, user, maxTokens = 1200, temperature = 0.7 }) {
  const url = `${config.ai.baseUrl}/chat/completions`;
  const headers = { "content-type": "application/json" };
  if (config.ai.apiKey) headers.authorization = `Bearer ${config.ai.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.ai.model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  let text = json?.choices?.[0]?.message?.content?.toString() || "";
  // Some reasoning models (e.g. deepseek-r1) wrap thoughts in <think>…</think>.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!text) throw new Error("AI returned empty response");
  return text;
}

export function extractJson(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}
