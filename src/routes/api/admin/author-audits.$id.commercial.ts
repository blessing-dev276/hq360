import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/admin/author-audits/$id/commercial")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        (await import("@/lib/author-audit/commercial.server")).commercialAdmin(request, params.id),
      POST: async ({ request, params }) =>
        (await import("@/lib/author-audit/commercial.server")).commercialAdmin(request, params.id),
    },
  },
});
