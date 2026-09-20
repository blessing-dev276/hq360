import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin/scout-batches/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const { data: batch } = await db
            .from("scout_batches")
            .select("*")
            .eq("id", params.id)
            .maybeSingle();
          if (!batch) return json({ ok: false, error: "not_found" }, 404);

          const { data: books, error } = await db
            .from("scout_discovered_books")
            .select(
              "*, scout_authors(*), scout_review_counts(platform, review_count, rating, verified), scout_prospects(id, status)",
            )
            .eq("batch_id", params.id)
            .order("discovered_at", { ascending: false });
          if (error) return json({ ok: false, error: "storage" }, 500);

          return json({ ok: true, batch, items: books ?? [] });
        } catch (err) {
          console.error("[admin/scout-batches.$id] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
