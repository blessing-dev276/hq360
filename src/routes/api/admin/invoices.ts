import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/invoices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { paymentJson, listInvoices, combinedSetup } =
          await import("@/lib/payments/invoices.server");
        if (!(await isAdminRequest(request))) return paymentJson({ error: "Unauthorized" }, 401);
        try {
          const invoices = await listInvoices();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
          const bankIds = invoices.filter((i) => i.provider === "bank_transfer").map((i) => i.id);
          const { data: rows, error: receiptError } = bankIds.length
            ? await db
                .from("bank_transfer_receipts")
                .select("id,invoice_id,status,submitted_at")
                .in("invoice_id", bankIds)
                .order("submitted_at", { ascending: false })
            : { data: [], error: null };
          if (receiptError) throw receiptError;
          const receipts: Record<string, { id: string; status: string; submitted_at: string }> = {};
          for (const row of rows ?? [])
            if (!receipts[row.invoice_id]) receipts[row.invoice_id] = row;
          return paymentJson({ invoices, receipts, setup: combinedSetup() });
        } catch {
          return paymentJson(
            {
              error:
                "Invoice storage is unavailable. Apply the payments migration and check the database connection.",
              setup: combinedSetup(),
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
