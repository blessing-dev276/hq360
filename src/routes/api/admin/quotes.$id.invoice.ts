import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/admin/quotes/$id/invoice")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { quoteAccess, quotesTable, json } = await import("@/lib/quotes.server");
        const who = await quoteAccess(request);
        if (!who) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const { z } = await import("zod");
        if (!z.string().uuid().safeParse(params.id).success)
          return json({ error: "Quote not found." }, 404);
        const { conversionInput, quoteInvoiceDetails } = await import("@/lib/quote-invoice.server");
        const parsed = conversionInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json(
            { error: parsed.error.issues[0]?.message || "Check the invoice details." },
            400,
          );
        let query = quotesTable().select("*").eq("id", params.id);
        if (!who.admin) query = query.eq("owner", who.owner);
        const { data: quote, error: quoteError } = await query.maybeSingle();
        if (quoteError) return json({ error: "Could not load the quote." }, 503);
        if (!quote) return json({ error: "Quote not found." }, 404);
        try {
          const details = quoteInvoiceDetails(
            quote,
            parsed.data.package_index,
            parsed.data.payment_method,
          );
          if (
            details.currency === "USD" &&
            parsed.data.payment_method === "bank_transfer" &&
            !parsed.data.bank_transfer_amount_minor
          )
            throw new Error("Enter the agreed EUR bank transfer amount.");
          const bankAmount =
            parsed.data.payment_method === "bank_transfer"
              ? details.currency === "EUR"
                ? details.amount_minor
                : parsed.data.bank_transfer_amount_minor
              : undefined;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as SupabaseClient;
          if (who.admin) {
            const { getInvoice, createInvoice } = await import("@/lib/payments/invoices.server");
            const existing = await db
              .from("payment_invoices")
              .select("id")
              .eq("source_quote_id", params.id)
              .maybeSingle();
            if (existing.error) throw new Error("Could not check the quote's invoice.");
            if (existing.data)
              return json({
                kind: "invoice",
                invoice: await getInvoice(existing.data.id),
                existing: true,
              });
            try {
              const invoice = await createInvoice({
                id: crypto.randomUUID(),
                provider: parsed.data.payment_method,
                ...details,
                bank_transfer_amount_minor: bankAmount,
                buyer_email: parsed.data.buyer_email,
                buyer_phone: parsed.data.buyer_phone,
                due_date: parsed.data.due_date,
                source_quote_id: params.id,
                source_package_index: parsed.data.package_index,
                // An expert's quote is sent to the buyer under their name.
                ...(quote.owner && quote.owner !== "hq360"
                  ? { sender_expert_id: quote.owner }
                  : {}),
              });
              return json({ kind: "invoice", invoice, existing: false }, 201);
            } catch (error) {
              const retry = await db
                .from("payment_invoices")
                .select("id")
                .eq("source_quote_id", params.id)
                .maybeSingle();
              if (retry.data)
                return json({
                  kind: "invoice",
                  invoice: await getInvoice(retry.data.id),
                  existing: true,
                });
              throw error;
            }
          }
          const requests = db.from("expert_invoice_requests");
          const existing = await requests
            .select("id,status,invoice_id")
            .eq("source_quote_id", params.id)
            .eq("expert_id", who.owner)
            .maybeSingle();
          if (existing.error) throw new Error("Could not check the quote's invoice request.");
          if (existing.data)
            return json({ kind: "request", request: existing.data, existing: true });
          const createRequest = async () =>
            requests
              .insert({
                expert_id: who.owner,
                ...details,
                bank_transfer_amount_minor: bankAmount,
                buyer_email: parsed.data.buyer_email,
                buyer_phone: parsed.data.buyer_phone,
                due_date: parsed.data.due_date,
                payment_type:
                  parsed.data.payment_method === "bank_transfer"
                    ? "bank_transfer"
                    : parsed.data.payment_method === "nowpayments"
                      ? "crypto"
                      : "card",
                source_quote_id: params.id,
                source_package_index: parsed.data.package_index,
              })
              .select("id,status,invoice_id")
              .single();
          const created = await createRequest();
          if (created.data)
            return json({ kind: "request", request: created.data, existing: false }, 201);
          const retry = await requests
            .select("id,status,invoice_id")
            .eq("source_quote_id", params.id)
            .eq("expert_id", who.owner)
            .maybeSingle();
          if (retry.data) return json({ kind: "request", request: retry.data, existing: true });
          throw new Error("Could not create an invoice request from this quote.");
        } catch (error) {
          return json(
            { error: error instanceof Error ? error.message : "Could not create the invoice." },
            400,
          );
        }
      },
    },
  },
});
