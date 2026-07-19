// Derives a person-category ("who is this?") from their profile facts.
// An explicit category from the form always wins; otherwise keyword rules run
// top-to-bottom — more specific categories first.
// Must include every category the client offers, so explicit picks are accepted.
export const CATEGORIES = [
  "Founder", "Co-founder", "Investor", "Job Seeker", "Student", "Freelancer",
  "Consultant", "Developer", "Designer", "Product Manager", "Marketer", "Sales",
  "Operations", "Researcher", "Mentor", "Creator", "Executive", "Engineer",
  "Data Scientist", "Agripreneur", "Nonprofit", "Other",
];

// Keyword rules for auto-detection, most-specific first.
const RULES = [
  ["Agripreneur", /agri|farm(er|ing)?\b|agro|agritech|agriculture|dairy|crop|horticultur/i],
  ["Nonprofit", /non[- ]?profit|\bngo\b|charity|social (impact|enterprise)|foundation/i],
  ["Investor", /\binvestor\b|venture capital|\bvc\b|angel invest|fund manager|partner at|\blp\b/i],
  ["Executive", /\bceo\b|\bcto\b|\bcoo\b|\bcfo\b|\bcmo\b|\bcxo\b|chief \w+ officer|vice president|\bvp\b|managing director/i],
  ["Founder", /founder|co-?founder|entrepreneur|started my (own|company)|my startup|building a (startup|company)/i],
  ["Product Manager", /product manager|\bpm\b|product owner|product lead/i],
  ["Data Scientist", /data scien|machine learning eng|\bml\b engineer|data analyst|\bai\b engineer/i],
  ["Designer", /design(er)?\b|\bui\/?ux\b|product design|graphic|brand design/i],
  ["Developer", /developer|software eng|engineer|programmer|\bswe\b|full[- ]?stack|backend|frontend|coder|\bdev\b/i],
  ["Marketer", /market(er|ing)|growth|\bseo\b|brand(ing)?|social media manager/i],
  ["Sales", /\bsales\b|account executive|business development|\bbd\b|revenue/i],
  ["Researcher", /research(er)?|\bphd\b|scientist|professor|academic/i],
  ["Mentor", /mentor|advisor|coach/i],
  ["Creator", /creator|content creat|influencer|youtuber|blogger|podcast/i],
  ["Consultant", /consultant|consulting|agency owner|advisory/i],
  ["Job Seeker", /job ?seek|looking for[^.\n]{0,40}(job|work\b|role|position|internship|placement|opportunit)|open to work|seeking[^.\n]{0,30}(job|role|position|internship)|unemployed|career (change|switch)/i],
  ["Student", /student|final year|undergrad|\bb\.?tech\b|\bmba\b|\bbca\b|\bmca\b|university|college|graduating/i],
  ["Freelancer", /freelanc|independent contractor|self[- ]?employed/i],
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
