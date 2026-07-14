// Deterministic contact block appended to each generated intro (spec §6.3). No emoji.
export function buildContactBlock(d) {
  const lines = [];
  const email = (d.email || "").trim();
  if (email && /.+@.+\..+/.test(email)) lines.push(`Email: ${email}`);

  const phone = (d.phone || "").trim();
  const waRaw = (d.whatsapp || "").trim() || phone;
  if (phone || waRaw) {
    const digits = waRaw.replace(/[^\d+]/g, "").replace(/^\+/, "");
    const waLink = digits ? ` - chat: https://wa.me/${digits}?text=${encodeURIComponent("Hello")}` : "";
    lines.push(`Phone: ${phone || waRaw}${waLink}`);
  }

  const li = (d.linkedin || []).filter(Boolean);
  if (li.length) lines.push(`LinkedIn: ${li.join(" · ")}`);

  const web = (d.website || []).filter(Boolean);
  if (web.length) lines.push(`Web: ${web.join(" · ")}`);

  const s = d.socials || {};
  const social = [];
  if (s.twitter) social.push(`X/Twitter: ${s.twitter}`);
  if (s.instagram) social.push(`Instagram: ${s.instagram}`);
  if (s.youtube) social.push(`YouTube: ${s.youtube}`);
  if (s.github) social.push(`GitHub: ${s.github}`);
  if (s.other) social.push(s.other);
  if (social.length) lines.push(`Social: ${social.join(" · ")}`);

  return lines.length ? `\n\n- Contact -\n${lines.join("\n")}` : "";
}

export function appendContact(intros, contact) {
  if (!contact) return intros;
  const out = {};
  for (const k of Object.keys(intros)) out[k] = intros[k] ? `${intros[k]}${contact}` : intros[k];
  return out;
}
