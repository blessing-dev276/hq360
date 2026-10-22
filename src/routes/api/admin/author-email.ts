import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/author-email")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/author-email.server")).handleAuthorEmail(request),
      POST: async ({ request }) =>
        (await import("@/lib/author-email.server")).handleAuthorEmail(request),
    },
  },
});
