// Deterministic intro generator used when the AI endpoint is unavailable, so the
// "Generate" button always returns usable drafts. No emoji, mirrors the 4 tones.
function firstSentence(s) {
  const t = (s || "").trim();
  if (!t) return "";
  const m = t.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}

export function fallbackIntros(d) {
  const name = d.name || "there";
  const roleCo = [d.role, d.company && `at ${d.company}`].filter(Boolean).join(" ");
  const where = d.city ? ` based in ${d.city}` : "";
  const sector = d.sector ? ` in ${d.sector}` : "";
  const help = (d.can_help_with || "").trim();
  const seek = (d.looking_for || "").trim();
  const bio = firstSentence(d.bio);

  const lead = `${name}${roleCo ? `, ${roleCo}` : ""}${where}`;

  const professional = [
    `${lead}${sector ? `, working${sector}` : ""}.`,
    bio && bio,
    help && `I can help with ${help.replace(/\.$/, "")}.`,
    seek && `I'm looking for ${seek.replace(/\.$/, "")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const friendly = [
    `Hi everyone, I'm ${name}${where}.`,
    roleCo && `I work as ${roleCo}${sector ? `${sector}` : ""}.`,
    help && `Happy to help with ${help.replace(/\.$/, "")}.`,
    seek && `Would love to connect with anyone around ${seek.replace(/\.$/, "")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const concise = [
    `${name}${roleCo ? ` - ${roleCo}` : ""}${where}.`,
    seek ? `Looking for ${seek.replace(/\.$/, "")}.` : help ? `Can help with ${help.replace(/\.$/, "")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const storytelling = [
    bio || `${lead}.`,
    roleCo && `Today I'm ${roleCo}${sector ? `, focused${sector}` : ""}.`,
    help && `Along the way I've learned a lot about ${help.replace(/\.$/, "")}.`,
    seek && `Right now I'm hoping to connect with people who can help with ${seek.replace(/\.$/, "")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return { professional, friendly, concise, storytelling };
}
