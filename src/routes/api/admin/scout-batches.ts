import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb, type ScoutBatch } from "@/lib/scout/db";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/scout-batches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const { data, error } = await db
            .from("scout_batches")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, items: (data ?? []) as ScoutBatch[] });
        } catch (err) {
          console.error("[admin/scout-batches] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
