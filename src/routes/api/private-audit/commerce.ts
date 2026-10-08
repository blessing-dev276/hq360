import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/private-audit/commerce")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/author-audit/commercial.server")).clientCommercial(request),
      POST: async ({ request }) =>
        (await import("@/lib/author-audit/commercial.server")).auditInquiry(request),
    },
  },
});
