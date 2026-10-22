import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildAuthorEmail, authorEmailSchema } from "./author-email";
import { sendEmail } from "./email.server";

export const outreachTable = () => (supabaseAdmin as SupabaseClient).from("author_outreach");
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function sendTrackedOutreach(
  input: z.infer<typeof authorEmailSchema>,
  config: { from: string; replyTo: string },
) {
  const recipient = input.to.toLowerCase();
  // Normalize the recipient and persist the exact rendered payload before sending.
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([recipient, input.subject, input.content, input.senderName, input.isTest]),
    )
    .digest("hex");
  const { data: blocked, error: blockError } = await outreachTable()
    .select("id")
    .eq("recipient", recipient)
    .eq("is_test", false)
    .or("workflow.eq.opted_out,delivery_status.in.(bounced,complained,suppressed)")
    .limit(1);
  if (blockError) return json({ error: "Outreach history is unavailable. Nothing was sent." }, 503);
  if (blocked?.length)
    return json(
      {
        error:
          "This recipient has opted out or has a bounce, complaint or suppression recorded. Sending is blocked.",
      },
      409,
    );
  const email = buildAuthorEmail(input);
  const { data: inserted, error: insertError } = await outreachTable()
    .insert({
      id: input.requestId,
      fingerprint,
      recipient,
      subject: input.subject,
      content: input.content,
      sender_name: input.senderName,
      from_address: config.from,
      reply_to: config.replyTo,
      html: email.html,
      plain_text: email.text,
      is_test: input.isTest,
    })
    .select()
    .single();
  if (insertError && insertError.code !== "23505")
    return json({ error: "Could not save outreach history. Nothing was sent." }, 503);
  let row = inserted;
  if (!row) {
    const existing = await outreachTable().select().eq("fingerprint", fingerprint).maybeSingle();
    if (existing.error || !existing.data)
      return json(
        {
          error:
            "Send reference already belongs to another message. Reload before composing a new email.",
        },
        409,
      );
    row = existing.data;
  }
  if (row.send_status === "accepted")
    return json({ accepted: true, id: row.provider_id, outreachId: row.id, duplicate: true });
  // Resend only retains idempotency for 24h. Never automatically retry outside it.
  if (Date.now() - Date.parse(row.created_at) > 23 * 60 * 60 * 1000)
    return json(
      {
        error:
          "This earlier send is unconfirmed and too old to retry safely. Check its delivery in Resend before composing another email.",
      },
      409,
    );
  const result = await sendEmail({
    to: row.recipient,
    subject: row.subject,
    html: row.html,
    text: row.plain_text,
    from: row.from_address,
    replyTo: row.reply_to,
    idempotencyKey: `author-outreach/${row.id}`,
  });
  if (!result.sent) {
    await outreachTable()
      .update({ send_status: "unconfirmed" })
      .eq("id", row.id)
      .neq("send_status", "accepted");
    return json(
      {
        error:
          "Resend did not confirm acceptance. The attempt is saved in history. Retry the unchanged email safely or check Resend.",
      },
      502,
    );
  }
  const saved = await outreachTable()
    .update({ send_status: "accepted", provider_id: result.id || null })
    .eq("id", row.id);
  return json({
    accepted: true,
    id: result.id,
    outreachId: row.id,
    ...(saved.error
      ? {
          warning:
            "Resend accepted the email, but its status could not be saved. Refresh and check Resend before retrying.",
        }
      : {}),
  });
}

export const workflowValues = [
  "awaiting_reply",
  "replied",
  "interested",
  "follow_up",
  "closed",
  "opted_out",
] as const;
export async function listOutreach(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(0, Math.min(100000, Number(url.searchParams.get("page")) || 0));
  const search = (url.searchParams.get("search") || "")
    .trim()
    .slice(0, 254)
    .replace(/[%_\\]/g, "\\$&");
  let query = outreachTable().select(
    "id,recipient,subject,content,sender_name,source,is_test,send_status,provider_id,delivery_status,checked_at,workflow,notes,follow_up_on,created_at",
    { count: "exact" },
  );
  if (search) query = query.ilike("recipient", `%${search}%`);
  const workflow = url.searchParams.get("workflow");
  if (workflow && workflowValues.includes(workflow as (typeof workflowValues)[number]))
    query = query.eq("workflow", workflow);
  const kind = url.searchParams.get("kind");
  if (kind === "authors" || kind === "tests")
    query = query.eq("is_test", kind === "tests").eq("source", "composer");
  if (kind === "imports") query = query.eq("source", "resend_import");
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(Math.floor(page) * 25, Math.floor(page) * 25 + 24);
  return error
    ? json({ error: "Could not load outreach history." }, 503)
    : json({ items: data || [], total: count || 0 });
}
const updateSchema = z.object({
  id: z.string().uuid(),
  workflow: z.enum(workflowValues),
  notes: z.string().max(5000),
  followUpOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    })
    .nullable(),
});
export async function updateOutreach(request: Request) {
  const body = await request.json().catch(() => null);
  if (body?.action === "refresh") {
    const id = z.string().uuid().safeParse(body.id);
    if (!id.success) return json({ error: "Invalid email reference." }, 400);
    const { data: row, error } = await outreachTable()
      .select("provider_id")
      .eq("id", id.data)
      .maybeSingle();
    if (error) return json({ error: "History unavailable." }, 503);
    if (!row?.provider_id)
      return json({ error: "No Resend reference is recorded for this attempt." }, 409);
    if (!process.env.RESEND_API_KEY) return json({ error: "Resend is not configured." }, 503);
    try {
      const response = await fetch(
        `https://api.resend.com/emails/${encodeURIComponent(row.provider_id)}`,
        {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        return json(
          {
            error:
              "Could not check Resend. The API key needs permission to read emails; wait and retry if rate limited.",
          },
          502,
        );
      const email = (await response.json()) as { last_event?: string };
      const statuses = [
        "bounced",
        "canceled",
        "clicked",
        "complained",
        "delivered",
        "delivery_delayed",
        "failed",
        "opened",
        "queued",
        "scheduled",
        "sent",
        "suppressed",
      ];
      if (!email.last_event || !statuses.includes(email.last_event))
        return json({ error: "Resend did not return a recognized delivery status." }, 502);
      const saved = await outreachTable()
        .update({ delivery_status: email.last_event, checked_at: new Date().toISOString() })
        .eq("id", id.data);
      return saved.error
        ? json({ error: "Could not save delivery status." }, 503)
        : json({ ok: true });
    } catch {
      return json({ error: "Could not reach Resend. Try again shortly." }, 502);
    }
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Check the follow-up fields." }, 400);
  const { data, error } = await outreachTable()
    .update({
      workflow: parsed.data.workflow,
      notes: parsed.data.notes,
      follow_up_on: parsed.data.followUpOn,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  return error
    ? json({ error: "Could not save follow-up." }, 503)
    : !data
      ? json({ error: "Outreach not found." }, 404)
      : json({ ok: true });
}
