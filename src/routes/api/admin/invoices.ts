import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/invoices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { paymentJson, listInvoices } = await import("@/lib/payments/invoices.server");
        if (!(await isAdminRequest(request))) return paymentJson({ error: "Unauthorized" }, 401);
        const { paymentSetup } = await import("@/lib/payments/nowpayments.server");
        try {
          return paymentJson({ invoices: await listInvoices(), setup: paymentSetup() });
        } catch {
          return paymentJson(
            {
              error:
                "Invoice storage is unavailable. Apply the payments migration and check the database connection.",
              setup: paymentSetup(),
            },
            503,
          );
        }
      },
      POST: async ({ request }) => {
        const { paymentJson, sameOrigin, invoiceSchema, createInvoice } =
          await import("@/lib/payments/invoices.server");
        if (!(await isAdminRequest(request))) return paymentJson({ error: "Unauthorized" }, 401);
        if (!sameOrigin(request)) return paymentJson({ error: "Invalid origin" }, 403);
        const parsed = invoiceSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return paymentJson({ error: "Check the buyer details, amount and due date." }, 400);
        try {
          return paymentJson({ invoice: await createInvoice(parsed.data) }, 201);
        } catch {
          return paymentJson(
            { error: "Could not save the invoice. Check the database connection and migration." },
            503,
          );
        }
      },
    },
  },
});
