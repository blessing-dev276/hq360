import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { createCaseStudySchema, serializeCaseStudy, toInsertRow } from "@/lib/case-study-shape";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/case-studies")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("case_studies")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, items: (data ?? []).map(serializeCaseStudy) });
        } catch (err) {
          console.error("[admin/case-studies] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof createCaseStudySchema>;
        try {
          body = createCaseStudySchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: last } = await supabaseAdmin
            .from("case_studies")
            .select("sort_order")
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextOrder = (last?.sort_order ?? -1) + 1;

          const { data, error } = await supabaseAdmin
            .from("case_studies")
            .insert({ ...toInsertRow(body), sort_order: nextOrder })
            .select("*")
            .single();
          if (error || !data) {
            const duplicate = error?.code === "23505";
            return json(
              { ok: false, error: duplicate ? "duplicate_slug" : "storage" },
              duplicate ? 409 : 500,
            );
          }
          return json({ ok: true, item: serializeCaseStudy(data) });
        } catch (err) {
          console.error("[admin/case-studies] POST", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
