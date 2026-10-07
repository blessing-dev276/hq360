import { createFileRoute } from "@tanstack/react-router";
import { isAdminOrExpertRequest } from "@/lib/expert-auth.server";
import { asAuditDb } from "@/lib/author-audit/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/author-audit-leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminOrExpertRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        const { auditActor } = await import("@/lib/author-audit/workflow-access.server");
        const actor = await auditActor(request);
        if (!actor) return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asAuditDb(supabaseAdmin);
          // Admin sees every request (with the referring expert); an expert sees
          // only requests that came through their own referral link.
          let query = db
            .from("author_audit_leads")
            .select("*, expert:expert_profiles(full_name, email)")
            .order("created_at", { ascending: false });
          if (!actor.admin) query = query.eq("expert_id", actor.id);
          const { data, error } = await query;
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, items: data ?? [] });
        } catch (err) {
          console.error("[admin/author-audit-leads] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
