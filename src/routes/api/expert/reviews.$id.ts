import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/expert/reviews/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const { isExpertRequest } = await import("@/lib/expert-auth.server");
        const { expertReviews } = await import("@/lib/expert-reviews.server");
        const expertId = await isExpertRequest(request, { profileWrite: true });
        if (!expertId) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const { error } = await expertReviews()
          .delete()
          .eq("id", params.id)
          .eq("expert_id", expertId);
        if (error) return json({ error: "Could not delete this review." }, 503);
        return json({ ok: true });
      },
    },
  },
});
