// Sends the generated intros to the user's inbox via Resend.
// Requires RESEND_API_KEY and a verified MAIL_FROM sender.
import { config } from "../config.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const TONE_LABELS = {
  professional: "Professional",
  friendly: "Friendly",
  concise: "Pitch",
  storytelling: "Investor-ready",
};

function buildHtml(name, intros) {
  const blocks = ["professional", "friendly", "concise", "storytelling"]
    .filter((k) => (intros[k] || "").trim())
    .map(
      (k) => `
      <div style="margin:0 0 20px;">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a80;margin-bottom:6px;">${TONE_LABELS[k]}</div>
        <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;color:#1a1a1a;background:#f6f5ee;border:1px solid #ececdf;border-radius:12px;padding:14px 16px;">${esc(intros[k])}</div>
      </div>`
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#eae9e4;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px -20px rgba(0,0,0,.25);">
        <div style="background:#1a1a1a;color:#fdfdfb;padding:22px 26px;font-weight:600;font-size:18px;">SVTouch Intro Generator</div>
        <div style="padding:24px 26px;">
          <p style="font-size:16px;color:#1a1a1a;margin:0 0 4px;">Hi ${esc(name || "there")},</p>
          <p style="font-size:14px;color:#666;margin:0 0 20px;">Here are your four founder introductions — pick the one that sounds most like you.</p>
          ${blocks}
          <p style="font-size:12px;color:#999;margin:20px 0 0;">Generated at svtouch.com — reply to tweak or ask us to build something like this for you.</p>
        </div>
      </div>
    </div>
  </body></html>`;
}

export async function sendIntrosEmail({ to, name, intros }) {
  if (!config.resendKey) throw new Error("email not configured (RESEND_API_KEY missing)");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.resendKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.mailFrom,
      to: [to],
      subject: "Your founder intros — SVTouch",
      html: buildHtml(name, intros),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return true;
}
