import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pay/$token/receipt")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { getInvoice, paymentJson, sameOrigin } =
          await import("@/lib/payments/invoices.server");
        const { MAX_RECEIPT_BYTES, submitBankReceipt } =
          await import("@/lib/payments/receipts.server");
        if (!sameOrigin(request)) return paymentJson({ error: "Invalid origin" }, 403);
        if (Number(request.headers.get("content-length")) > MAX_RECEIPT_BYTES + 100_000)
          return paymentJson({ error: "Choose a screenshot under 4 MB." }, 413);
        try {
          const invoice = await getInvoice(params.token, true);
          const form = await request.formData();
          const file = form.get("screenshot");
          if (!(file instanceof File)) return paymentJson({ error: "Choose a screenshot." }, 400);
          const receipt = await submitBankReceipt(invoice, file);
          return paymentJson({ receipt }, 201);
        } catch (error) {
          return paymentJson(
            { error: error instanceof Error ? error.message : "Could not submit screenshot." },
            400,
          );
        }
      },
    },
  },
});
