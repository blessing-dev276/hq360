import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy article URLs. Slugs are preserved in Insights, so forward directly.
export const Route = createFileRoute("/blog/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ statusCode: 301, href: `/insights/${params.slug}` });
  },
});
