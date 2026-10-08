// Branded layout for notification emails (expert and admin). Table based with
// inline styles only, so it renders the same in Gmail, Outlook and Apple Mail
// and doesn't trip spam filters: no images except the logo, no tracking.

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
const paragraphs = (text: string, style: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

export type NotificationItem = { title: string; body: string; url: string; cta?: string };

export function buildNotificationEmail(input: {
  siteOrigin: string;
  eyebrow: string;
  greeting: string;
  intro: string;
  items: NotificationItem[];
  footer: string;
}) {
  const { siteOrigin } = input;
  // Paragraphs every item ends with (a shared note or sign-off) are shown once,
  // after the cards, instead of repeating in each one.
  const split = input.items.map((n) => n.body.split(/\n{2,}/));
  const shared: string[] = [];
  if (split.length > 1)
    for (let k = 1; k <= Math.min(...split.map((p) => p.length)) - 1; k++) {
      const tail = split[0]![split[0]!.length - k]!;
      if (!split.every((p) => p[p.length - k] === tail)) break;
      shared.unshift(tail);
    }
  const items = input.items.map((n, i) => ({
    ...n,
    body: split[i]!.slice(0, split[i]!.length - shared.length).join("\n\n"),
  }));
  const preheader =
    items.length === 1 ? items[0]!.title : `${items.length} updates waiting for you`;
  const cards = items
    .map(
      (n) => `
        <tr><td style="padding:0 36px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:16px;">
            <tr><td style="padding:20px 22px;">
              <p style="margin:0;font-size:17px;line-height:1.35;font-weight:800;color:${INK};">${esc(n.title)}</p>
              ${paragraphs(n.body, `margin:10px 0 0;font-size:14.5px;line-height:1.65;color:${MUTED};`)}
              <a href="${esc(n.url)}" style="display:inline-block;margin-top:16px;padding:11px 20px;border-radius:999px;background:${ORANGE};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${esc(n.cta || "Open")} &rarr;</a>
            </td></tr>
          </table>
        </td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(preheader)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ef;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ef;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${LINE};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:6px;background:${ORANGE};font-size:0;line-height:6px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 36px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td><img src="${siteOrigin}/logo-email.png" width="110" alt="HQ360" style="display:block;width:110px;height:auto;border:0;"></td>
            <td align="right" style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${ORANGE};font-weight:700;">${esc(input.eyebrow)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:22px 36px 18px;">
          <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:${INK};">${esc(input.greeting)}</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">${esc(input.intro)}</p>
        </td></tr>
        ${cards}
        ${
          shared.length
            ? `<tr><td style="padding:4px 36px 14px;">${paragraphs(shared.join("\n\n"), `margin:0 0 10px;font-size:14.5px;line-height:1.65;color:${INK};`)}</td></tr>`
            : ""
        }
        <tr><td style="padding:6px 36px 30px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#9aa0a6;">${esc(input.footer)}</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:18px 8px 0;font-size:12px;color:#9aa0a6;">HQ360 · <a href="${siteOrigin}" style="color:#9aa0a6;">${esc(siteOrigin.replace(/^https?:\/\//, ""))}</a></td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    input.greeting,
    "",
    input.intro,
    "",
    ...items.map((n) => `• ${n.title}\n${n.body}\n${n.cta || "Open"}: ${n.url}\n`),
    ...(shared.length ? [shared.join("\n\n"), ""] : []),
    input.footer,
    "",
    "HQ360",
  ].join("\n");
  return { html, text };
}
