import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/pay/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => publicInvoice(params.token, false),
      POST: async ({ request, params }) => {
        const { sameOrigin, paymentJson } = await import("@/lib/payments/invoices.server");
        if (!sameOrigin(request)) return paymentJson({ error: "Invalid origin" }, 403);
        return publicInvoice(params.token, true);
      },
    },
  },
});
async function publicInvoice(token: string, verify: boolean) {
  const p = await import("@/lib/payments/invoices.server");
  try {
    let invoice = await p.getInvoice(token, true);
    if (!invoice.provider_invoice_id)
      return p.paymentJson({ error: "This invoice is not ready for payment." }, 404);
    if (verify) invoice = await p.verifyInvoice(invoice);
    const checkoutUrl = p.checkoutUrlFor(invoice);
    let receipt: { status: string; submitted_at: string; admin_note: string | null } | null = null;
    if (invoice.provider === "bank_transfer") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
      const { data } = await db
        .from("bank_transfer_receipts")
        .select("status,submitted_at,admin_note")
        .eq("invoice_id", invoice.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      receipt = data;
    }
    return p.paymentJson({
      receipt,
      // The expert the buyer sees as the sender (null = HQ360).
      sender: await p.invoiceSender(invoice.sender_expert_id),
      invoice: {
        number: invoice.number,
        description: invoice.description,
        title: invoice.title ?? "",
        package_name: invoice.package_name ?? "",
        included: invoice.included ?? [],
        installment: invoice.installment ?? "full",
        project_total_minor: invoice.project_total_minor ?? null,
        buyer_name: invoice.buyer_name,
        created_at: invoice.created_at,
        paid_at: invoice.paid_at,
        amount_minor: invoice.amount_minor,
        bank_transfer_amount_minor: invoice.bank_transfer_amount_minor,
        currency: invoice.currency,
        due_date: invoice.due_date,
        status: invoice.status,
        provider: invoice.provider,
        provider_invoice_id: invoice.provider_invoice_id,
        provider_status: invoice.provider_status,
        environment: invoice.environment,
      },
      checkout: {
        url: checkoutUrl,
      },
    });
  } catch {
    return p.paymentJson(
      {
        error: verify
          ? "Unable to verify payment yet. Please try again shortly."
          : "This invoice is unavailable. Please contact HQ360.",
      },
      verify ? 503 : 404,
    );
  }
}
