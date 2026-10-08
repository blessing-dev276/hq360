import { createFileRoute } from "@tanstack/react-router";
import { perplexitySettings } from "../expert/perplexity-settings";
export const Route = createFileRoute("/api/admin/perplexity-settings")({
  server: {
    handlers: {
      GET: ({ request }) => perplexitySettings(request, true),
      PUT: ({ request }) => perplexitySettings(request, true),
      DELETE: ({ request }) => perplexitySettings(request, true),
    },
  },
});
