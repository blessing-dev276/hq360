// Outreach email rendering, shared by the admin preview (browser) and the
// sender (server) so what you preview is exactly what is sent.
//
// Deliverability rules baked in: a real plain-text part, a single short
// sentence of unsubscribe text, no tracking pixels, no remote fonts, at most
// one small image (the logo), inline styles only, and a body that is mostly
// text. The "letter" design reads like a personal email with an HQ360
// signature; the "card" design matches the branded invoice email.

export type OutreachTemplate = "letter" | "card";

export type OutreachRender = {
  template: OutreachTemplate;
  toName: string;
  subject: string;
  body: string;
  senderName: string;
  senderTitle: string;
  siteOrigin: string;
  unsubscribeUrl: string;
  /** Postal address shown in the footer (anti-spam law in many countries). */
  address?: string | undefined;
};

const ORANGE = "#ff5a00";
const INK = "#111416";
const MUTED = "#5f6368";
const LINE = "#ececec";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Replace {first_name} / {name} placeholders. */
export function personalize(text: string, toName: string) {
  const first = firstName(toName) || "there";
  return text
    .replace(/\{\s*first_name\s*\}/gi, first)
    .replace(/\{\s*name\s*\}/gi, toName.trim() || first);
}

/** Paragraphs from blank-line-separated text; single newlines become <br>.
 *  Bare https:// URLs become links (written out in full, never hidden). */
function paragraphsHtml(text: string, style: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const linked = esc(p).replace(
        /(https:\/\/[^\s<]+[^\s<.,;:!?)])/g,
        `<a href="$1" style="color:${ORANGE};">$1</a>`,
      );
      return `<p style="${style}">${linked.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function renderOutreach(input: OutreachRender) {
  const body = personalize(input.body, input.toName);
  const subject = personalize(input.subject, input.toName);
  const site = input.siteOrigin.replace(/^https?:\/\//, "");
  const logo = `${input.siteOrigin}/logo-text.png`;

  const text = [
    body.trim(),
    "",
    "--",
    input.senderName,
    input.senderTitle ? `${input.senderTitle}, HQ360` : "HQ360",
    site,
    "",
    `Not interested? Unsubscribe: ${input.unsubscribeUrl}`,
    input.address ?? "",
  ]
    .join("\n")
    .trim();

  const signature = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr>
        <td style="padding-right:14px;border-right:2px solid ${ORANGE};vertical-align:middle;">
          <img src="${logo}" width="72" alt="HQ360" style="display:block;width:72px;height:auto;border:0;">
        </td>
        <td style="padding-left:14px;vertical-align:middle;font-family:${FONT};">
          <p style="margin:0;font-size:14px;font-weight:700;color:${INK};">${esc(input.senderName)}</p>
          ${input.senderTitle ? `<p style="margin:2px 0 0;font-size:13px;color:${MUTED};">${esc(input.senderTitle)}, HQ360</p>` : ""}
          <p style="margin:2px 0 0;font-size:13px;"><a href="${input.siteOrigin}" style="color:${ORANGE};text-decoration:none;">${esc(site)}</a></p>
        </td>
      </tr>
    </table>`;

  const footer = `
    <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#8a8f94;">
      Not interested? <a href="${esc(input.unsubscribeUrl)}" style="color:#8a8f94;">Unsubscribe</a> and we won't email you again.${
        input.address ? `<br>${esc(input.address)}` : ""
      }
    </p>`;

  const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>`;

  const paragraphStyle = `margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${INK};`;

  const html =
    input.template === "letter"
      ? `${head}
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:24px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
    <tr><td>
      ${paragraphsHtml(body, paragraphStyle)}
      ${signature}
    </td></tr>
    <tr><td style="padding-top:32px;">${footer}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
      : `${head}
<body style="margin:0;padding:0;background:#f4f2ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ef;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:20px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:6px;background:${ORANGE};font-size:0;line-height:6px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 36px 4px;">
          <img src="${logo}" width="120" alt="HQ360" style="display:block;width:120px;height:auto;border:0;">
        </td></tr>
        <tr><td style="padding:20px 36px 30px;">
          ${paragraphsHtml(body, paragraphStyle)}
          ${signature}
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 16px 0;">${footer}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

// --- Content check ---------------------------------------------------------

const SPAMMY = [
  "100% free",
  "act now",
  "amazing deal",
  "buy now",
  "cash bonus",
  "click here",
  "double your",
  "earn money",
  "free money",
  "guarantee",
  "limited time",
  "no obligation",
  "once in a lifetime",
  "risk-free",
  "risk free",
  "urgent",
  "winner",
  "100% satisfied",
  "best price",
  "make money",
];

/** Warnings about wording and structure that push cold email toward spam. */
export function outreachWarnings(subject: string, body: string) {
  const warnings: string[] = [];
  const all = `${subject}\n${body}`.toLowerCase();
  const hits = SPAMMY.filter((phrase) => all.includes(phrase));
  if (hits.length) warnings.push(`Spam-trigger wording: ${hits.map((h) => `“${h}”`).join(", ")}.`);
  if (/[A-Z]{5,}/.test(subject.replace(/HQ360/g, "")))
    warnings.push("Avoid ALL-CAPS words in the subject.");
  if (/!{2,}|\?{2,}/.test(all) || (subject.match(/!/g) ?? []).length > 0)
    warnings.push("Avoid exclamation marks in the subject and repeated punctuation.");
  if (/\$\s?\d|£\s?\d|€\s?\d|\bprice\b|\bdiscount\b|%\s?off/i.test(subject))
    warnings.push("Keep prices and discounts out of the subject line.");
  if (subject.length > 70) warnings.push("Keep the subject under 70 characters.");
  const links = (body.match(/https?:\/\//g) ?? []).length;
  if (links > 2) warnings.push("Use at most two links in a cold email.");
  if (/https?:\/\/(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)/i.test(body))
    warnings.push("Don't use link shorteners; they are heavily filtered.");
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (words < 25) warnings.push("Very short emails look automated; aim for 50–200 words.");
  if (words > 350) warnings.push("Long cold emails get fewer replies; aim for under 200 words.");
  if (!/\{\s*first_name\s*\}|\{\s*name\s*\}/i.test(body))
    warnings.push("Personalise it: greet the author by name with {first_name}.");
  return warnings;
}
