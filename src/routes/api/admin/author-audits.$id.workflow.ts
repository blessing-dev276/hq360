import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/admin/author-audits/$id/workflow")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        (await import("@/lib/author-audit/workflow.server")).workflowGet(request, params.id),
      POST: async ({ request, params }) =>
        (await import("@/lib/author-audit/workflow.server")).workflowPost(request, params.id),
    },
  },
});
