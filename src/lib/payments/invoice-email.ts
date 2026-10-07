import { money, providerLabel, type Invoice } from "./types";

// Branded invoice email. Email clients ignore <style> blocks and modern CSS,
// so this is table-based with inline styles only, a 600px card, system
// fonts and no background images -- the layout that renders consistently in
// Gmail, Outlook and Apple Mail and doesn't trip spam filters.

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

function longDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

export function buildInvoiceEmail(invoice: Invoice, payUrl: string, siteOrigin: string) {
  const test = invoice.environment === "demo";
  const amount = money(invoice.amount_minor, invoice.currency);
  const due = longDate(invoice.due_date);
  const issued = longDate(invoice.created_at);
  const first = invoice.buyer_name.trim().split(/\s+/)[0] || invoice.buyer_name;
  const method = providerLabel(invoice.provider);

  const subject = `${test ? "Test: " : ""}Invoice ${invoice.number} from HQ360, ${amount} due ${due}`;
  // Inbox preview line shown next to the subject.
  const preheader = `${amount} for ${invoice.description.slice(0, 80)}. Due ${due}.`;

  const text = [
    test ? "This is a test invoice. No real payment will be collected.\n" : "",
    `Hi ${first},`,
    "",
    `Thank you for working with HQ360. Your invoice ${invoice.number} is ready.`,
    "",
    `Amount due: ${amount}`,
    `Due date: ${due}`,
    `For: ${invoice.description}`,
    "",
    `View and pay securely (${method}):`,
    payUrl,
    "",
    "Questions about this invoice? Just reply to this email.",
    "",
    "HQ360",
    siteOrigin.replace(/^https?:\/\//, ""),
  ]
    .filter((line, i) => i > 0 || line)
    .join("\n");

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${MUTED};">${esc(label)}</td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};font-weight:600;">${esc(value)}</td>
    </tr>`;

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
    ${
      test
        ? `<tr><td style="padding:10px 16px;margin-bottom:12px;background:#fff4e5;border:1px solid #ffd8a8;border-radius:12px;font-size:13px;color:#8a4b00;text-align:center;">Test invoice: no real payment will be collected.</td></tr>
    <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>`
        : ""
    }
    <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${LINE};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:6px;background:${ORANGE};font-size:0;line-height:6px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 36px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td><img src="${siteOrigin}/logo-email.png" width="120" alt="HQ360" style="display:block;width:120px;height:auto;border:0;"></td>
            <td align="right" style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">Invoice<br><span style="font-size:15px;letter-spacing:0;text-transform:none;color:${INK};font-weight:700;">${esc(invoice.number)}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 36px 0;">
          <p style="margin:0 0 6px;font-size:16px;color:${INK};">Hi ${esc(first)},</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">Thank you for working with HQ360. Here's your invoice. You can review it and pay securely online.</p>
        </td></tr>
        <tr><td style="padding:24px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7f2;border:1px solid #ffe0cc;border-radius:16px;">
            <tr><td style="padding:22px 24px;">
              <p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${ORANGE};font-weight:700;">Amount due</p>
              <p style="margin:6px 0 0;font-size:34px;line-height:1.1;font-weight:800;color:${INK};">${esc(amount)}</p>
              <p style="margin:8px 0 0;font-size:14px;color:${MUTED};">Due ${esc(due)}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td colspan="2" style="padding:0 0 6px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">For</td></tr>
            <tr><td colspan="2" style="padding:0 0 14px;border-bottom:1px solid ${LINE};font-size:15px;line-height:1.6;color:${INK};">${esc(invoice.description)}</td></tr>
            ${row("Billed to", invoice.buyer_name)}
            ${row("Invoice date", issued)}
            ${row("Due date", due)}
            ${row("Payment method", method)}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:30px 36px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" style="border-radius:999px;background:${ORANGE};">
              <a href="${esc(payUrl)}" style="display:inline-block;padding:15px 40px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">View &amp; pay invoice</a>
            </td>
          </tr></table>
          <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">Button not working? Copy this link into your browser:<br><a href="${esc(payUrl)}" style="color:${ORANGE};word-break:break-all;">${esc(payUrl)}</a></p>
        </td></tr>
        <tr><td style="padding:24px 36px 30px;">
          <p style="margin:0;padding-top:20px;border-top:1px solid ${LINE};font-size:13px;line-height:1.6;color:${MUTED};">Questions about this invoice? Just reply to this email and the HQ360 team will help.</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 16px 0;font-size:12px;line-height:1.6;color:#8a8f94;">
      HQ360 &middot; <a href="${siteOrigin}" style="color:#8a8f94;">${esc(siteOrigin.replace(/^https?:\/\//, ""))}</a><br>
      You're receiving this because an invoice was issued to ${esc(invoice.buyer_email)}.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
