import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
export const Route = createFileRoute("/api/payments/nowpayments/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { paymentJson, getInvoice, reconcilePayment } =
          await import("@/lib/payments/invoices.server");
        const { verifyIpnSignature } = await import("@/lib/payments/nowpayments.server");
        if (!process.env.NOWPAYMENTS_IPN_SECRET?.trim())
          return paymentJson({ error: "Notifications are not configured." }, 503);
        if (Number(request.headers.get("content-length") || 0) > 65536)
          return paymentJson({ error: "Payload too large" }, 413);
        const reader = request.body?.getReader();
        if (!reader) return paymentJson({ error: "Missing payload" }, 400);
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 65536) {
            await reader.cancel();
            return paymentJson({ error: "Payload too large" }, 413);
          }
          chunks.push(value);
        }
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return paymentJson({ error: "Invalid JSON" }, 400);
        }
        if (!verifyIpnSignature(payload, request.headers.get("x-nowpayments-sig")))
          return paymentJson({ error: "Invalid signature" }, 401);
        if (
          !payload ||
          !z.string().uuid().safeParse(payload.order_id).success ||
          !/^\d+$/.test(String(payload.payment_id ?? ""))
        )
          return paymentJson({ error: "Invalid notification" }, 400);
        try {
          const invoice = await getInvoice(String(payload.order_id));
          if (!invoice.provider_invoice_id)
            return paymentJson(
              { error: "Invoice issuance is still being saved. Retry notification." },
              503,
            );
          await reconcilePayment(invoice, String(payload.payment_id));
          return paymentJson({ ok: true });
        } catch {
          return paymentJson({ error: "Notification could not be reconciled. Retry later." }, 503);
        }
      },
    },
  },
});
