// Webhook-ready lead forwarding.
//
// Every inbound lead (project inquiry, growth-audit request) can be pushed to an
// external system. This keeps HQ360 CRM-agnostic: point it at GoHighLevel,
// HubSpot, Zapier, Make or any webhook by setting env vars (see .env.example):
//
//   LEAD_WEBHOOK_URL=https://...            (generic JSON POST — Zapier/Make/GHL inbound)
//   LEAD_WEBHOOK_SECRET=...                 (sent as X-HQ360-Signature header, optional)
//   LEAD_WEBHOOK_AUTH_HEADER=Authorization  (optional custom auth header name)
//   LEAD_WEBHOOK_AUTH_VALUE=Bearer xyz      (optional custom auth header value)
//
// With nothing configured, forwarding is a logged no-op and the caller still
// succeeds (the lead is already stored in Supabase).

export type LeadKind =
  | "author_visibility_check"
  | "sales_lead_updated"
  | "project_inquiry"
  | "growth_audit_request"
  | "resource_request";

export type LeadPayload = {
  kind: LeadKind;
  /** Stable across initial capture and later sales updates. */
  recordKey?: string;
  id: string;
  createdAt: string;
  email: string;
  name?: string | undefined;
  company?: string | undefined;
  website?: string | undefined;
  industry?: string | undefined;
  sourcePath?: string | undefined;
  /** Anything extra specific to the lead kind. */
  fields?: Record<string, unknown>;
};

export type ForwardResult = { forwarded: boolean; status?: number; error?: string };

export async function forwardLead(payload: LeadPayload): Promise<ForwardResult> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) {
    console.log(
      `[lead-forwarding] no LEAD_WEBHOOK_URL — ${payload.kind} ${payload.id} not forwarded`,
    );
    return { forwarded: false, error: "LEAD_WEBHOOK_URL not set" };
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "HQ360-LeadForwarder/1.0",
  };

  const secret = process.env.LEAD_WEBHOOK_SECRET;
  if (secret) headers["X-HQ360-Signature"] = secret;

  const authHeader = process.env.LEAD_WEBHOOK_AUTH_HEADER;
  const authValue = process.env.LEAD_WEBHOOK_AUTH_VALUE;
  if (authHeader && authValue) headers[authHeader] = authValue;

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers,
      body: JSON.stringify({
        source: "hq360-website",
        recordKey:
          payload.recordKey ??
          `${payload.kind === "project_inquiry" ? "inquiry" : payload.kind === "author_visibility_check" ? "visibility_check" : payload.kind}:${payload.id}`,
        ...payload,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { forwarded: false, status: res.status, error: body.slice(0, 300) };
    }
    return { forwarded: true, status: res.status };
  } catch (err) {
    return { forwarded: false, error: err instanceof Error ? err.message : String(err) };
  }
}
