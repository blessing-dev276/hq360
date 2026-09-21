import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { asScoutDb } from "@/lib/scout/db";
import { z } from "zod";
const schema = z.object({
  authorId: z.string().uuid(),
  action: z.enum(["verify", "reject", "merge"]),
  targetId: z.string().uuid().optional(),
  evidence: z.string().trim().min(10).max(2000),
});
export const Route = createFileRoute("/api/admin/scout-identity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const [authors, reviews] = await Promise.all([
            db
              .from("scout_authors")
              .select("*")
              .eq("identity_status", "needs_review")
              .order("created_at", { ascending: false })
              .limit(100),
            db
              .from("scout_identity_reviews")
              .select(
                "*, candidate:scout_authors!scout_identity_reviews_candidate_id_fkey(id,name,source_url,author_profile_url)",
              )
              .eq("decision", "pending")
              .order("created_at", { ascending: false })
              .limit(200),
          ]);
          if (authors.error || reviews.error) throw authors.error ?? reviews.error;
          return Response.json({ ok: true, authors: authors.data, reviews: reviews.data });
        } catch {
          return Response.json({ ok: false, error: "Storage unavailable" }, { status: 503 });
        }
      },
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json(
            { ok: false, error: "Evidence (at least 10 characters) and valid author required" },
            { status: 400 },
          );
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = asScoutDb(supabaseAdmin);
          const b = parsed.data;
          if (b.action === "merge") {
            if (!b.targetId)
              return Response.json({ ok: false, error: "Target author required" }, { status: 400 });
            const { error } = await db.rpc("scout_merge_authors", {
              p_from: b.authorId,
              p_into: b.targetId,
              p_evidence: b.evidence,
            });
            if (error) throw error;
          } else {
            const { error } = await db.rpc("scout_review_author", {
              p_id: b.authorId,
              p_action: b.action,
              p_evidence: b.evidence,
            });
            if (error) throw error;
          }
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Review could not be saved",
            },
            { status: 409 },
          );
        }
      },
    },
  },
});
