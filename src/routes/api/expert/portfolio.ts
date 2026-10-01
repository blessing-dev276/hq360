import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const FIELDS =
  "id, title, description, image_url, external_link, service_slugs, audience_slugs, status, reviewed_at, created_at, updated_at";

const schema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000),
  image_url: z.string().trim().max(500),
  external_link: z.string().trim().max(300).url().or(z.literal("")),
  service_slugs: z.array(z.string().trim().min(1).max(60)).max(10),
  audience_slugs: z.array(z.string().trim().min(1).max(60)).max(10),
});

export const Route = createFileRoute("/api/expert/portfolio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest, expertPortfolioItems } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await expertPortfolioItems()
          .select(FIELDS)
          .eq("expert_id", expertId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: "Could not load your portfolio." }, 503);
        return json({ items: data ?? [] });
      },
      POST: async ({ request }) => {
        const { isExpertRequest, expertPortfolioItems } = await import("@/lib/expert-auth.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check your details." }, 400);
        const input = parsed.data;
        const photoPrefix = `${(process.env.SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/expert-photos/${expertId}/`;
        if (input.image_url && !input.image_url.startsWith(photoPrefix))
          return json({ error: "Upload your image using the image button." }, 400);
        const { data, error } = await expertPortfolioItems()
          .insert({
            expert_id: expertId,
            title: input.title,
            description: input.description || null,
            image_url: input.image_url || null,
            external_link: input.external_link || null,
            service_slugs: [...new Set(input.service_slugs)],
            audience_slugs: [...new Set(input.audience_slugs)],
            status: "pending",
          })
          .select(FIELDS)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not add this portfolio item." }, 503);
        return json({ item: data });
      },
    },
  },
});
