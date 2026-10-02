import { createFileRoute } from "@tanstack/react-router";
import { resolveScoutAccess } from "@/lib/scout/owner.server";
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
        const access = await resolveScoutAccess(request);
        if (!access) return json({ ok: false, error: "unauthorized" }, 401);
        if (!UUID.test(params.id)) return json({ ok: false, error: "invalid" }, 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);

          const { data: batch } = await db
            .from("scout_batches")
            .select("*")
            .eq("id", params.id)
            .eq("owner", access.owner)
            .maybeSingle();
          if (!batch) return json({ ok: false, error: "not_found" }, 404);

          const { data: books, error } = await db
            .from("scout_discovered_books")
            .select(
              "*, scout_batch_books!inner(batch_id), scout_authors(*), scout_review_counts(platform, review_count, rating, verified), scout_prospects(id, status)",
            )
            .eq("scout_batch_books.batch_id", params.id)
            // Only this workspace's own prospect status for each book.
            .eq("scout_prospects.owner", access.owner)
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
