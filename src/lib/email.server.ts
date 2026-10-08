// Transactional email abstraction.
//
// Wire a real provider by setting env vars (see .env.example):
//   EMAIL_PROVIDER=resend
//   RESEND_API_KEY=...
//   EMAIL_FROM="HQ360 <ceo@hq360.space>"
//
// With no provider configured, calls are logged and report `sent: false`, so
// the rest of a flow (DB write, on-page download) still completes.

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text body. HTML is derived from this if `html` is omitted. */
  text: string;
  html?: string;
  replyTo?: string;
  /** File bytes encoded as base64 for Resend. */
  attachments?: { filename: string; content: string; content_type: string }[];
};

export type EmailResult = { sent: boolean; id?: string; error?: string };

export const DEFAULT_CONTACT_EMAIL = "ceo@hq360.space";

export function leadInboxAddress(): string {
  return process.env.LEAD_EMAIL || process.env.EMAIL_TO || DEFAULT_CONTACT_EMAIL;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || `HQ360 <${DEFAULT_CONTACT_EMAIL}>`;
}

async function sendViaResend(msg: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not set" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? brandedHtml(msg.subject, msg.text),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { sent: true, ...(data.id ? { id: data.id } : {}) };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();

  if (provider === "resend") return sendViaResend(msg);

  console.log(`[email] no provider configured — would send "${msg.subject}" to ${msg.to}`);
  return { sent: false, error: "EMAIL_PROVIDER not configured" };
}

export async function sendLeadEmail(input: {
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<EmailResult> {
  const recipient = leadInboxAddress();
  return sendEmail({
    to: recipient,
    subject: input.subject,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
}

/** Any email sent as plain text still goes out in the HQ360 branded layout:
 *  logo, orange stripe, readable paragraphs, and links as buttons (a link on
 *  its own line) or inline links. Table-based, inline styles only. */
export function brandedHtml(subject: string, text: string): string {
  const site = (process.env.SITE_URL || "https://www.hq360.space").replace(/\/$/, "");
  const linkify = (s: string) =>
    escapeHtml(s).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#ff5a00;word-break:break-all;">$1</a>',
    );
  const blocks = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (/^https?:\/\/\S+$/.test(t))
        return `<p style="margin:18px 0;"><a href="${escapeHtml(t)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#ff5a00;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Open link &rarr;</a></p>`;
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3c4043;">${linkify(t).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ef;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #ececec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:6px;background:#ff5a00;font-size:0;line-height:6px;">&nbsp;</td></tr>
<tr><td style="padding:28px 36px 4px;"><img src="${site}/logo-email.png" width="110" alt="HQ360" style="display:block;width:110px;height:auto;border:0;"></td></tr>
<tr><td style="padding:22px 36px 0;"><p style="margin:0 0 16px;font-size:19px;line-height:1.35;font-weight:800;color:#111416;">${escapeHtml(subject)}</p></td></tr>
<tr><td style="padding:0 36px 26px;">${blocks}</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:18px 8px 0;font-size:12px;color:#9aa0a6;">HQ360 · <a href="${site}" style="color:#9aa0a6;">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
}
