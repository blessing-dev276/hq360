import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";
import { reedsyPolicy } from "@/lib/scout/sources/reedsy/policy";
export const Route = createFileRoute("/api/admin/scout-reedsy-authors")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        try {
          const url = new URL(request.url);
          const genre = url.searchParams.get("genre")?.trim();
          const page = Math.max(
            0,
            Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 0)),
          );
          const saved = url.searchParams.get("saved") === "true";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          let query = db
            .from("scout_authors")
            .select(
              `id,name,bio,author_profile_url,website_url,identity_status,scout_discovered_books!inner(id,title,genre,source_url,cover_image_url),scout_prospects${saved ? "!inner" : ""}(id,status,do_not_contact)`,
              { count: "exact" },
            )
            .eq("scout_discovered_books.source_slug", "reedsy_discovery")
            .is("merged_into", null)
            .neq("identity_status", "rejected")
            .order("created_at", { ascending: false })
            .order("id")
            .range(page * 25, page * 25 + 24);
          if (genre) query = query.eq("scout_discovered_books.genre", genre);
          const { data, error, count } = await query;
          if (error) throw error;
          return Response.json({
            ok: true,
            items: data ?? [],
            total: count ?? 0,
            access: { canCrawl: false, message: reedsyPolicy.reason },
          });
        } catch (error) {
          console.error("[scout/reedsy-authors]", error);
          return Response.json(
            { ok: false, error: "Could not load Reedsy authors." },
            { status: 503 },
          );
        }
      },
    },
  },
});
