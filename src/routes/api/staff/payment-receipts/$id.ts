import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
export const Route = createFileRoute("/api/staff/payment-receipts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const p = await import("@/lib/payments/receipts.server");
        if (!(await p.canReviewBankReceipts(request)))
          return json({ error: "Sign in as Admin or Founder." }, 401);
        try {
          const { receipt, invoice } = await p.getBankReceipt(params.id);
          return json({
            receipt: {
              id: receipt.id,
              status: receipt.status,
              submitted_at: receipt.submitted_at,
              reviewed_at: receipt.reviewed_at,
              bank_reference: receipt.bank_reference,
              admin_note: receipt.admin_note,
            },
            invoice,
          });
        } catch {
          return json({ error: "Receipt not found." }, 404);
        }
      },
      POST: async ({ request, params }) => {
        const p = await import("@/lib/payments/receipts.server");
        if (!(await p.canReviewBankReceipts(request))) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const body = await request.json().catch(() => null);
        if (body?.action !== "approve" && body?.action !== "reject")
          return json({ error: "Invalid action." }, 400);
        try {
          const { receipt, invoice } = await p.getBankReceipt(params.id);
          if (receipt.status !== "submitted" || invoice.provider !== "bank_transfer")
            return json({ error: "Receipt is no longer awaiting review." }, 409);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
          if (body.action === "approve") {
            if (
              body.bank_checked !== true ||
              typeof body.reference !== "string" ||
              !/^.{3,200}$/.test(body.reference.trim())
            )
              return json(
                { error: "Check the bank receipt and enter its transaction reference." },
                400,
              );
            const { error } = await db.rpc("approve_bank_transfer_receipt", {
              p_receipt_id: params.id,
              p_bank_reference: body.reference.trim(),
            });
            if (error) return json({ error: error.message }, 409);
            return json({ ok: true, status: "approved" });
          }
          const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
          const { data, error } = await db
            .from("bank_transfer_receipts")
            .update({
              status: "rejected",
              reviewed_at: new Date().toISOString(),
              admin_note: note || null,
            })
            .eq("id", params.id)
            .eq("status", "submitted")
            .select("id");
          if (error || !data?.length)
            return json({ error: "Receipt is no longer awaiting review." }, 409);
          return json({ ok: true, status: "rejected" });
        } catch {
          return json({ error: "Could not review this receipt." }, 400);
        }
      },
    },
  },
});
