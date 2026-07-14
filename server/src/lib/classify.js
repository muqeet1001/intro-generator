// Derives a person-category ("who is this?") from their profile facts.
// An explicit category from the form always wins; otherwise keyword rules run
// top-to-bottom — more specific categories first.
export const CATEGORIES = [
  "Agripreneur",
  "Investor",
  "Founder",
  "Job Seeker",
  "Student",
  "Developer",
  "Designer",
  "Marketer",
  "Freelancer",
  "Other",
];

const RULES = [
  ["Agripreneur", /agri|farm(er|ing)?\b|agro|agritech|agriculture|dairy|crop|horticultur/i],
  ["Investor", /\binvestor\b|venture capital|\bvc\b|angel invest|fund manager|\blp\b/i],
  ["Founder", /founder|co-?founder|\bceo\b|\bcto\b|\bcoo\b|entrepreneur|started my (own|company)|my startup|building a (startup|company)/i],
  ["Job Seeker", /job ?seek|looking for[^.\n]{0,40}(job|work\b|role|position|internship|placement|opportunit)|open to work|seeking[^.\n]{0,30}(job|role|position|internship)|unemployed|career (change|switch)/i],
  ["Student", /student|final year|undergrad|\bb\.?tech\b|\bmba\b|\bbca\b|\bmca\b|university|college|graduating/i],
  ["Designer", /design(er)?\b|\bui\/?ux\b|product design|graphic/i],
  ["Developer", /developer|engineer|programmer|\bswe\b|full[- ]?stack|backend|frontend|software|coder|\bdev\b/i],
  ["Marketer", /market(er|ing)|growth|\bseo\b|brand(ing)?|content creat|social media/i],
  ["Freelancer", /freelanc|consultant|consulting|agency owner|independent contractor/i],
];

export function classifyPerson(d = {}) {
  const explicit = String(d.category || "").trim();
  if (explicit && CATEGORIES.includes(explicit)) return explicit;

  // role is the strongest signal — check it alone first.
  const role = String(d.role || "");
  for (const [cat, re] of RULES) {
    if (re.test(role)) return cat;
  }
  // The looking_for field IS the "looking for …" sentence — if someone is
  // looking for a job/internship/position, they're a job seeker.
  const seeking = String(d.looking_for || "");
  if (/\b(job|internship|placement|employment|full[- ]?time|part[- ]?time|hire me|position|openings?)\b/i.test(seeking)) {
    return "Job Seeker";
  }
  const text = [d.bio, seeking, d.can_help_with, d.company, d.sector]
    .map((v) => String(v || ""))
    .join(" \n ");
  for (const [cat, re] of RULES) {
    if (re.test(text)) return cat;
  }
  return "Other";
}
