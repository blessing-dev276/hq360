import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";
export const Route = createFileRoute("/api/admin/scout-crawl-history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const slug = new URL(request.url).searchParams.get("slug");
          if (!slug) return Response.json({ ok: false }, { status: 400 });
          const [runs, urls] = await Promise.all([
            db
              .from("scout_crawl_runs")
              .select("*")
              .eq("source_slug", slug)
              .order("started_at", { ascending: false })
              .limit(20),
            db
              .from("scout_book_sources")
              .select("source_url,collected_at")
              .eq("source_slug", slug)
              .order("collected_at", { ascending: false })
              .limit(100),
          ]);
          if (runs.error || urls.error) throw runs.error ?? urls.error;
          return Response.json({ ok: true, runs: runs.data, urls: urls.data });
        } catch {
          return Response.json({ ok: false, error: "Storage unavailable" }, { status: 503 });
        }
      },
    },
  },
});
