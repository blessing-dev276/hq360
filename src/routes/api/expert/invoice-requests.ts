import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const FIELDS =
  "id, buyer_name, buyer_email, buyer_phone, description, amount_minor, due_date, payment_type, status, admin_note, invoice_id, created_at, reviewed_at";

const schema = z.object({
  buyer_name: z.string().trim().min(2).max(150),
  buyer_email: z.string().trim().email().max(254),
  buyer_phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ()-]{7,25}$/),
  description: z.string().trim().min(3).max(1000),
  amount_minor: z.number().int().positive().max(10000000000),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
      "Invalid date",
    ),
  payment_type: z.enum(["card", "crypto"]),
});

export const Route = createFileRoute("/api/expert/invoice-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest, expertInvoiceRequests } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await expertInvoiceRequests()
          .select(FIELDS)
          .eq("expert_id", expertId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: "Could not load your invoice requests." }, 503);
        return json({ requests: data ?? [] });
      },
      POST: async ({ request }) => {
        const { isExpertRequest, expertInvoiceRequests } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check your details." }, 400);
        const { data, error } = await expertInvoiceRequests()
          .insert({ expert_id: expertId, ...parsed.data, status: "pending" })
          .select(FIELDS)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not submit this invoice request." }, 503);
        return json({ request: data });
      },
    },
  },
});
