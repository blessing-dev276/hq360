// Proposal email: one personal note with a single link to the proposal.
// Same deliverability rules as the invoice email: table layout, inline styles,
// a plain-text part, no attachments, no tracking pixels, one clear link,
// replies to a real inbox, and no salesy trigger words in the subject.

const ORANGE = "#ff5a00";
const INK = "#111416";
const MUTED = "#5f6368";
const LINE = "#ececec";

function esc(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function buildProposalEmail(
  p: { title: string; client_name: string; prepared_by: string; prepared_by_role: string },
  link: string,
  siteOrigin: string,
) {
  // "Dr Rod Graham" -> "Rod": skip titles like Dr, Mr, Ms, Prof.
  const first =
    p.client_name
      .trim()
      .split(/\s+/)
      .find((w) => !/^(dr|mr|mrs|ms|miss|prof|sir)\.?$/i.test(w)) || "there";
  const sender = p.prepared_by || "HQ360";
  const subject = `${p.title} for ${p.client_name || "you"}`.slice(0, 140);
  const preheader = `Your proposal from ${sender} at HQ360 is ready to read.`;
  const text = [
    `Hi ${first},`,
    "",
    "Thank you for your time. As promised, here is the proposal we put together for you:",
    "",
    p.title,
    link,
    "",
    "You can read it online and download a PDF copy from the same page. If you'd like to adjust anything, just reply to this email.",
    "",
    "Best regards,",
    sender,
    p.prepared_by_role || "HQ360",
    siteOrigin.replace(/^https?:\/\//, ""),
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ef;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ef;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${LINE};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:6px;background:${ORANGE};font-size:0;line-height:6px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 36px 8px;">
          <img src="${siteOrigin}/logo-email.png" width="120" alt="HQ360" style="display:block;width:120px;height:auto;border:0;">
        </td></tr>
        <tr><td style="padding:22px 36px 0;">
          <p style="margin:0 0 12px;font-size:16px;color:${INK};">Hi ${esc(first)},</p>
          <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">Thank you for your time. As promised, here is the proposal we put together for you.</p>
        </td></tr>
        <tr><td style="padding:22px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7f2;border:1px solid #ffe0cc;border-radius:16px;">
            <tr><td style="padding:20px 22px;">
              <p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${ORANGE};font-weight:700;">Proposal</p>
              <p style="margin:6px 0 0;font-size:20px;line-height:1.3;font-weight:800;color:${INK};">${esc(p.title)}</p>
              ${p.client_name ? `<p style="margin:6px 0 0;font-size:14px;color:${MUTED};">Prepared for ${esc(p.client_name)}</p>` : ""}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 36px 0;">
          <a href="${esc(link)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:${ORANGE};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Read the proposal</a>
          <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">You can also download a PDF copy from the same page. If the button doesn't work, open this link:<br><a href="${esc(link)}" style="color:${ORANGE};word-break:break-all;">${esc(link)}</a></p>
        </td></tr>
        <tr><td style="padding:24px 36px 30px;">
          <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">If you'd like to adjust anything, just reply to this email.</p>
          <p style="margin:18px 0 0;font-size:15px;color:${INK};">Best regards,<br><strong>${esc(sender)}</strong><br><span style="color:${MUTED};">${esc(p.prepared_by_role || "HQ360")}</span></p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:18px 8px 0;font-size:12px;color:#9aa0a6;">HQ360 · <a href="${siteOrigin}" style="color:#9aa0a6;">${esc(siteOrigin.replace(/^https?:\/\//, ""))}</a></td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}
