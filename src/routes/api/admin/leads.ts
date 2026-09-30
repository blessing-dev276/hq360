import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { leadSchema } from "@/lib/sales";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
async function handle(request: Request) {
  if (!(await isAdminRequest(request))) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as SupabaseClient;
    if (request.method === "GET") {
      const [leads, invoices, events] = await Promise.all([
        db.from("sales_leads").select("*").order("created_at", { ascending: false }),
        db
          .from("payment_invoices")
          .select("id,number,buyer_name,status,environment,payment_token")
          .eq("provider", "nowpayments")
          .order("created_at", { ascending: false }),
        db
          .from("sales_events")
          .select("lead_id,event,detail,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (leads.error || invoices.error || events.error)
        return json(
          { ok: false, error: "Could not load sales records. Check the sales workflow migration." },
          503,
        );
      return json({
        ok: true,
        items: leads.data ?? [],
        invoices: invoices.data ?? [],
        events: events.data ?? [],
      });
    }
    const raw = await request.json().catch(() => null);
    const parsed = (
      request.method === "PATCH" ? leadSchema.extend({ id: z.string().uuid() }) : leadSchema
    ).safeParse(raw);
    if (!parsed.success)
      return json({ ok: false, error: "Check the required fields, dates and links." }, 400);
    const { id, ...values } = parsed.data as z.infer<typeof leadSchema> & { id?: string };
    if (id) {
      const { data: existing } = await db
        .from("sales_leads")
        .select("source_kind,source_id")
        .eq("id", id)
        .single();
      if (!existing) return json({ ok: false, error: "Lead not found" }, 404);
      if (existing.source_kind === "scout" && values.stage !== "lost") {
        const { data: prospect, error } = await db
          .from("scout_prospects")
          .select("status,do_not_contact")
          .eq("id", existing.source_id)
          .single();
        if (error || !prospect || prospect.do_not_contact || prospect.status === "excluded")
          return json(
            {
              ok: false,
              error:
                "This Scout prospect is excluded or unavailable. Review the Scout record first.",
            },
            409,
          );
      }
    }
    const query = id
      ? db
          .from("sales_leads")
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq("id", id)
      : db.from("sales_leads").insert({ ...values, source_kind: "manual" });
    const { data, error } = await query.select("*").single();
    if (error || !data) return json({ ok: false, error: "Could not save lead." }, 500);
    const { forwardLead } = await import("@/lib/lead-forwarding.server");
    const result = await forwardLead({
      kind: "sales_lead_updated",
      recordKey: `${data.source_kind}:${data.source_id ?? data.id}`,
      id: data.id,
      createdAt: data.created_at,
      name: data.name,
      email: data.email,
      fields: data,
    });
    return json({ ok: true, item: data, forwarded: result.forwarded });
  } catch {
    return json({ ok: false, error: "Sales records are unavailable." }, 503);
  }
}
export const Route = createFileRoute("/api/admin/leads")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
    },
  },
});
