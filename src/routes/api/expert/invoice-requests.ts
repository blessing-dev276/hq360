import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const FIELDS =
  "id, buyer_name, buyer_email, buyer_phone, description, amount_minor, currency, bank_transfer_amount_minor, due_date, payment_type, status, admin_note, invoice_id, created_at, reviewed_at";

const schema = z.object({
  buyer_name: z.string().trim().min(2).max(150),
  buyer_email: z.string().trim().email().max(254),
  buyer_phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{7,25}$/)
    .or(z.literal(""))
    .default(""),
  description: z.string().trim().min(3).max(1000),
  amount_minor: z.number().int().positive().max(10000000000),
  bank_transfer_amount_minor: z.number().int().positive().max(10000000000).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
      "Invalid date",
    ),
  payment_type: z.enum(["card", "crypto", "bank_transfer"]),
});

export const Route = createFileRoute("/api/expert/invoice-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest, expertInvoiceRequests } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { expertHasFeature } = await import("@/lib/expert-auth.server");
        if (!(await expertHasFeature(expertId, "invoices")))
          return json({ error: "Invoices aren't enabled for your account yet." }, 403);
        const { data, error } = await expertInvoiceRequests()
          .select(FIELDS)
          .eq("expert_id", expertId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: "Could not load your invoice requests." }, 503);
        // Attach the buyer pay link for requests admin has turned into an invoice.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const invoiceIds = (data ?? []).map((row) => row.invoice_id).filter(Boolean);
        const invoices = new Map<
          string,
          { number: string; status: string; payment_token: string }
        >();
        if (invoiceIds.length) {
          const { data: rows } = await (supabaseAdmin as SupabaseClient)
            .from("payment_invoices")
            .select("id, number, status, payment_token")
            .in("id", invoiceIds);
          for (const row of rows ?? []) invoices.set(row.id, row);
        }
        const origin = new URL(request.url).origin;
        return json({
          requests: (data ?? []).map(({ invoice_id, ...row }) => {
            const invoice = invoice_id ? invoices.get(invoice_id) : undefined;
            return {
              ...row,
              invoice: invoice
                ? {
                    number: invoice.number,
                    status: invoice.status,
                    pay_url:
                      invoice.status === "draft" ? null : `${origin}/pay/${invoice.payment_token}`,
                  }
                : null,
            };
          }),
        });
      },
      POST: async ({ request }) => {
        const { isExpertRequest, expertInvoiceRequests } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { expertHasFeature } = await import("@/lib/expert-auth.server");
        if (!(await expertHasFeature(expertId, "invoices")))
          return json({ error: "Invoices aren't enabled for your account yet." }, 403);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check your details." }, 400);
        const { data, error } = await expertInvoiceRequests()
          .insert({ expert_id: expertId, ...parsed.data, status: "pending" })
          .select(FIELDS)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not submit this invoice request." }, 503);
        return json({ request: data });
      },
    },
  },
});
