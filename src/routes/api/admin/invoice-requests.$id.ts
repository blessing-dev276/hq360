import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/invoice-requests/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return Response.json({ error: "Invalid origin" }, { status: 403 });
        const body = await request.json().catch(() => null);
        if (!["fulfill", "decline"].includes(body?.action))
          return Response.json({ error: "Invalid action" }, { status: 400 });
        const { expertInvoiceRequests } = await import("@/lib/expert-auth.server");
        const { data: reqRow, error: reqError } = await expertInvoiceRequests()
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        if (reqError || !reqRow)
          return Response.json({ error: "Invoice request not found." }, { status: 404 });
        if (reqRow.status !== "pending")
          return Response.json({ error: "This request was already reviewed." }, { status: 409 });

        if (body.action === "decline") {
          const note =
            typeof body?.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
          const { error } = await expertInvoiceRequests()
            .update({ status: "declined", admin_note: note, reviewed_at: new Date().toISOString() })
            .eq("id", params.id);
          if (error)
            return Response.json({ error: "Could not decline this request." }, { status: 503 });
          return Response.json({ ok: true });
        }

        const { createInvoice } = await import("@/lib/payments/invoices.server");
        try {
          const invoice = await createInvoice({
            id: crypto.randomUUID(),
            provider:
              reqRow.payment_type === "crypto"
                ? "nowpayments"
                : reqRow.payment_type === "bank_transfer"
                  ? "bank_transfer"
                  : "flutterwave",
            buyer_name: reqRow.buyer_name,
            buyer_email: reqRow.buyer_email,
            buyer_phone: reqRow.buyer_phone,
            description: reqRow.description,
            amount_minor: reqRow.amount_minor,
            ...(reqRow.payment_type === "bank_transfer"
              ? {
                  currency: reqRow.currency,
                  bank_transfer_amount_minor: reqRow.bank_transfer_amount_minor ?? undefined,
                }
              : {}),
            due_date: reqRow.due_date,
            requested_by_expert_id: reqRow.expert_id,
            ...(reqRow.source_quote_id
              ? {
                  source_quote_id: reqRow.source_quote_id,
                  source_package_index: reqRow.source_package_index,
                }
              : {}),
          });
          const { error } = await expertInvoiceRequests()
            .update({
              status: "fulfilled",
              invoice_id: invoice.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", params.id);
          if (error)
            return Response.json(
              { error: "Invoice created, but the request could not be linked." },
              { status: 503 },
            );
          return Response.json({ ok: true, invoice });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Could not create this invoice." },
            { status: 503 },
          );
        }
      },
    },
  },
});
