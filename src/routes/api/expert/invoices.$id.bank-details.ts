import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/expert/invoices/$id/bank-details")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { isExpertRequest, expertHasFeature } = await import("@/lib/expert-auth.server");
        const p = await import("@/lib/payments/invoices.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return p.paymentJson({ error: "Unauthorized" }, 401);
        if (!(await expertHasFeature(expertId, "invoices")))
          return p.paymentJson({ error: "Invoices aren't enabled for your account yet." }, 403);
        if (!p.sameOrigin(request)) return p.paymentJson({ error: "Invalid origin" }, 403);
        const body = await request.json().catch(() => null);
        try {
          if (body?.action === "set_bank_payment_terms") {
            const invoice = await p.updateInvoiceBankPaymentTerms(params.id, body.terms, expertId);
            return p.paymentJson({
              invoice: {
                currency: invoice.currency,
                amount_minor: invoice.amount_minor,
                bank_transfer_amount_minor: invoice.bank_transfer_amount_minor,
                bank_details: invoice.bank_details,
              },
            });
          }
          const invoice = await p.updateInvoiceBankDetails(params.id, body?.bank_details, expertId);
          return p.paymentJson({ bank_details: invoice.bank_details });
        } catch (error) {
          return p.paymentJson(
            { error: error instanceof Error ? error.message : "Could not save bank details." },
            400,
          );
        }
      },
    },
  },
});
