import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  imageUrl: z.string().max(2000).optional().or(z.literal("")),
  blurb: z.string().max(400).optional().or(z.literal("")),
  published: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/team")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("team_members")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, members: data ?? [] });
        } catch (err) {
          console.error("[admin/team] GET", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        let body: z.infer<typeof createSchema>;
        try {
          body = createSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: last } = await supabaseAdmin
            .from("team_members")
            .select("sort_order")
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextOrder = (last?.sort_order ?? -1) + 1;

          const { data, error } = await supabaseAdmin
            .from("team_members")
            .insert({
              name: body.name,
              title: body.title,
              image_url: body.imageUrl || null,
              blurb: body.blurb || null,
              published: body.published ?? true,
              sort_order: nextOrder,
            })
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, member: data });
        } catch (err) {
          console.error("[admin/team] POST", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
