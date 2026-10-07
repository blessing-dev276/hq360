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
  title: z.string().min(1).max(200),
  description: z.string().max(600).optional().or(z.literal("")),
  mediaType: z.enum(["image", "video"]),
  mediaUrl: z.string().min(1).max(2000),
  thumbnailUrl: z.string().max(2000).optional().or(z.literal("")),
  capabilitySlug: z.string().min(1).max(120),
  industrySlug: z.string().max(120).optional().or(z.literal("")),
  externalLink: z.string().max(2000).optional().or(z.literal("")),
  published: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/portfolio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("portfolio_items")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false });
          if (error) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, items: data ?? [] });
        } catch (err) {
          console.error("[admin/portfolio] GET", err instanceof Error ? err.message : err);
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
          // Place new items at the end.
          const { data: last } = await supabaseAdmin
            .from("portfolio_items")
            .select("sort_order")
            .order("sort_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextOrder = (last?.sort_order ?? 0) + 1;

          const { data, error } = await supabaseAdmin
            .from("portfolio_items")
            .insert({
              title: body.title,
              description: body.description || null,
              media_type: body.mediaType,
              media_url: body.mediaUrl,
              thumbnail_url: body.thumbnailUrl || null,
              capability_slug: body.capabilitySlug,
              industry_slug: body.industrySlug || null,
              external_link: body.externalLink || null,
              published: body.published ?? true,
              sort_order: nextOrder,
            })
            .select("*")
            .single();
          if (error || !data) return json({ ok: false, error: "storage" }, 500);
          return json({ ok: true, item: data });
        } catch (err) {
          console.error("[admin/portfolio] POST", err instanceof Error ? err.message : err);
          return json({ ok: false, error: "unavailable" }, 503);
        }
      },
    },
  },
});
