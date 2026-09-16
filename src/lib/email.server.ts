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
        html: msg.html ?? `<p>${escapeHtml(msg.text).replace(/\n/g, "<br>")}</p>`,
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
