import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/staff/payment-receipts/$id/image")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const p = await import("@/lib/payments/receipts.server");
        if (!(await p.canReviewBankReceipts(request)))
          return new Response("Unauthorized", { status: 401 });
        try {
          const { receipt } = await p.getBankReceipt(params.id);
          const image = await p.receiptImage(receipt.storage_path);
          return new Response(image, {
            headers: {
              "Content-Type": receipt.content_type,
              "Content-Disposition": "inline",
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
              "X-Robots-Tag": "noindex, nofollow",
            },
          });
        } catch {
          return new Response("Screenshot unavailable", { status: 404 });
        }
      },
    },
  },
});
