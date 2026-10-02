import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const CHECKOUT_TAG = "Website checkout";
const PER_EMAIL_PER_HOUR = 3;
const SITE_WIDE_PER_HOUR = 30;

const schema = z.object({
  plan: z.string().trim().min(1).max(40),
  buyer_name: z.string().trim().min(2).max(150),
  buyer_email: z.string().trim().email().max(254),
  buyer_phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{7,25}$/, "Enter a valid phone number."),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0, "Check your details and try again.").optional(),
});

/** Public "Pay now" for a website package: creates and issues a NOWPayments
 *  invoice at the package's server-side price, then returns its pay link. */
export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const p = await import("@/lib/payments/invoices.server");
        if (!p.sameOrigin(request)) return p.paymentJson({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return p.paymentJson(
            { error: parsed.error.issues[0]?.message || "Check your details and try again." },
            400,
          );
        const input = parsed.data;
        const { getPlan, planAmountMinor } = await import("@/data/pricing");
        const plan = getPlan(input.plan);
        if (!plan) return p.paymentJson({ error: "That package is not available." }, 404);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const invoices = () => (supabaseAdmin as SupabaseClient).from("payment_invoices");
        const since = new Date(Date.now() - 3600_000).toISOString();
        const [mine, all] = await Promise.all([
          invoices()
            .select("id", { count: "exact", head: true })
            .ilike("buyer_email", input.buyer_email)
            .like("description", `%${CHECKOUT_TAG}%`)
            .gte("created_at", since),
          invoices()
            .select("id", { count: "exact", head: true })
            .like("description", `%${CHECKOUT_TAG}%`)
            .gte("created_at", since),
        ]);
        if ((mine.count ?? 0) >= PER_EMAIL_PER_HOUR || (all.count ?? 0) >= SITE_WIDE_PER_HOUR)
          return p.paymentJson(
            { error: "Too many checkout attempts. Please try again in an hour or contact HQ360." },
            429,
          );

        try {
          const draft = await p.createInvoice({
            id: crypto.randomUUID(),
            provider: "nowpayments",
            buyer_name: input.buyer_name,
            buyer_email: input.buyer_email,
            buyer_phone: input.buyer_phone,
            description: `${plan.name} package (${plan.price} ${plan.cadence}) — ${CHECKOUT_TAG}`,
            amount_minor: planAmountMinor(plan),
            due_date: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10),
          });
          const invoice = await p.issueInvoice(draft);
          try {
            const { sendEmail, leadInboxAddress } = await import("@/lib/email.server");
            await sendEmail({
              to: leadInboxAddress(),
              subject: `New package checkout: ${plan.name} — ${input.buyer_name}`,
              text: `${input.buyer_name} (${input.buyer_email}, ${input.buyer_phone}) started checkout for the ${plan.name} package (${plan.price}).\n\nInvoice ${invoice.number} is issued and awaiting payment. Track it in Admin → Invoices.`,
            });
          } catch {
            // Notification is best-effort; the invoice is already live.
          }
          return p.paymentJson({ payUrl: `/pay/${invoice.payment_token}` });
        } catch {
          return p.paymentJson(
            { error: "Checkout is unavailable right now. Please try again or contact HQ360." },
            503,
          );
        }
      },
    },
  },
});
