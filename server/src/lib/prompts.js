// AI prompts — ported verbatim from the SVTouch intro generator spec (§6),
// with brand strings neutralised for Monster.

export const GENERATE_SYSTEM = `You write founder introductions for WhatsApp groups and networking. You will produce FOUR versions of the same person's intro in different tones. Output ONLY a valid JSON object with exactly these four string keys: "professional", "friendly", "concise", "storytelling". No markdown, no code fences, no commentary. Never use emoji or emoticons anywhere in the output. Use only the facts provided — never invent companies, titles, or achievements. Omit missing facts rather than fabricating.

Tone specs:
- professional: Polished and credible. Lead with role and concrete impact. 90-120 words. End with a clear, specific ask.
- friendly: Warm, first-person, conversational. Like a real person introducing themselves in a community group. No corporate jargon. 60-90 words.
- concise: WhatsApp-ready. One short paragraph, skimmable in 5 seconds. 30-50 words. No bullet points, no emoji-only lines.
- storytelling: Narrative arc - a one-line origin, what they're building and why it matters, and the specific help they're seeking. Human and grounded. 120-180 words.`;

export const EXTRACT_SYSTEM = `You extract structured profile facts from raw web page text. Output ONLY a valid JSON object with these string keys: "name","role","company","city","sector","bio","can_help_with","looking_for". Use "" for any field you can't confidently determine. Never invent. "bio" = 1-2 sentence summary in third person from the page. "sector" = short industry tag (e.g. "Fintech", "AI", "HealthTech"). "can_help_with" and "looking_for" = a short phrase only if clearly stated, otherwise "".`;

export function buildFacts(d) {
  return [
    `Name: ${d.name}`,
    d.role && `Role: ${d.role}`,
    d.company && `Company: ${d.company}`,
    d.city && `City: ${d.city}`,
    d.sector && `Sector: ${d.sector}`,
    d.bio && `Bio (user-provided):\n${d.bio}`,
    d.can_help_with && `Can help with: ${d.can_help_with}`,
    d.looking_for && `Looking for: ${d.looking_for}`,
  ]
    .filter(Boolean)
    .join("\n");
}
