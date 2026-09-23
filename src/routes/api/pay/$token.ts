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
    const { checkoutUrl } = await import("@/lib/payments/nowpayments.server");
    return p.paymentJson({
      invoice: {
        number: invoice.number,
        description: invoice.description,
        amount_minor: invoice.amount_minor,
        due_date: invoice.due_date,
        status: invoice.status,
        provider_invoice_id: invoice.provider_invoice_id,
        provider_status: invoice.provider_status,
        environment: invoice.environment,
      },
      checkout: {
        url: checkoutUrl(invoice.checkout_url, invoice.environment),
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
