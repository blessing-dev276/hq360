import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { REVIEW_FIELDS, REVIEW_PLATFORMS } from "@/lib/expert-reviews";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const schema = z.object({
  client_name: z.string().trim().min(2).max(120),
  platform: z.enum(REVIEW_PLATFORMS.map((p) => p.key) as [string, ...string[]]),
  rating: z.number().int().min(1).max(5).nullable(),
  review_text: z.string().trim().min(2).max(1500),
  review_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  screenshot_url: z.string().trim().min(1).max(500),
});

export const Route = createFileRoute("/api/expert/reviews")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const { expertReviews } = await import("@/lib/expert-reviews.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        const { data, error } = await expertReviews()
          .select(REVIEW_FIELDS)
          .eq("expert_id", expertId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: "Could not load your reviews." }, 503);
        return json({ items: data ?? [] });
      },
      POST: async ({ request }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const { expertReviews, expertPhotoPrefix } = await import("@/lib/expert-reviews.server");
        const expertId = await isExpertRequest(request);
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return json({ error: parsed.error.issues[0]?.message || "Check your details." }, 400);
        const input = parsed.data;
        if (!input.screenshot_url.startsWith(expertPhotoPrefix(expertId)))
          return json({ error: "Upload the screenshot using the upload button." }, 400);
        if (input.review_date && input.review_date > new Date().toISOString().slice(0, 10))
          return json({ error: "The review date can't be in the future." }, 400);
        const { data, error } = await expertReviews()
          .insert({
            expert_id: expertId,
            client_name: input.client_name,
            platform: input.platform,
            rating: input.rating,
            review_text: input.review_text,
            review_date: input.review_date || null,
            screenshot_url: input.screenshot_url,
            status: "pending",
          })
          .select(REVIEW_FIELDS)
          .maybeSingle();
        if (error || !data) return json({ error: "Could not save this review." }, 503);
        return json({ item: data });
      },
    },
  },
});
