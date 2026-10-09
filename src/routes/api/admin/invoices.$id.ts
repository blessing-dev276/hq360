import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
export const Route = createFileRoute("/api/admin/invoices/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const p = await import("@/lib/payments/invoices.server");
        if (!(await isAdminRequest(request))) return p.paymentJson({ error: "Unauthorized" }, 401);
        if (!p.sameOrigin(request)) return p.paymentJson({ error: "Invalid origin" }, 403);
        try {
          await p.deleteDraft(params.id);
          return p.paymentJson({ ok: true });
        } catch (error) {
          return p.paymentJson(
            { error: error instanceof Error ? error.message : "Could not delete draft." },
            409,
          );
        }
      },
      POST: async ({ request, params }) => {
        const p = await import("@/lib/payments/invoices.server");
        if (!(await isAdminRequest(request))) return p.paymentJson({ error: "Unauthorized" }, 401);
        if (!p.sameOrigin(request)) return p.paymentJson({ error: "Invalid origin" }, 403);
        const body = await request.json().catch(() => null);
        if (
          !["issue", "send", "verify", "cancel", "confirm_bank", "set_sender"].includes(
            body?.action,
          )
        )
          return p.paymentJson({ error: "Invalid action" }, 400);
        try {
          if (body.action === "set_sender") {
            // Who the buyer sees as the sender: an expert id, or null for HQ360.
            const sender = body.senderExpertId;
            if (sender !== null && !/^[0-9a-f-]{36}$/.test(String(sender)))
              return p.paymentJson({ error: "Pick an expert or HQ360." }, 400);
            await p.setInvoiceSender(params.id, sender);
            return p.paymentJson({ invoice: await p.getInvoice(params.id) });
          }
          if (body.action === "cancel") {
            await p.cancelInvoice(params.id);
            return p.paymentJson({ invoice: await p.getInvoice(params.id) });
          }
          const invoice = await p.getInvoice(params.id);
          const updated =
            body.action === "confirm_bank"
              ? await p.confirmBankTransfer(invoice, body.reference)
              : body.action === "issue"
                ? await p.issueInvoice(invoice)
                : body.action === "send"
                  ? await p.emailInvoice(invoice)
                  : await p.verifyInvoice(invoice);
          return p.paymentJson({ invoice: updated });
        } catch (error) {
          return p.paymentJson(
            { error: error instanceof Error ? error.message : "Unable to update invoice." },
            400,
          );
        }
      },
    },
  },
});
