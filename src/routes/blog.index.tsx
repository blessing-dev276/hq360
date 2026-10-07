import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy route — the blog is now "Insights".
export const Route = createFileRoute("/blog/")({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: "/resources" });
  },
});
