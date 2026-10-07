import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";

export const Route = createFileRoute("/api/admin/invoice-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { expertInvoiceRequests } = await import("@/lib/expert-auth.server");
        const { data, error } = await expertInvoiceRequests()
          .select(
            "id, expert_id, buyer_name, buyer_email, buyer_phone, description, amount_minor, due_date, payment_type, status, admin_note, invoice_id, created_at, reviewed_at, expert_profiles(full_name, email)",
          )
          .order("created_at", { ascending: false });
        if (error)
          return Response.json({ error: "Could not load invoice requests." }, { status: 503 });
        return Response.json({ requests: data ?? [] });
      },
    },
  },
});
