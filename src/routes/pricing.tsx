import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep old bookmarks working after removing the standalone pricing page. */
export const Route = createFileRoute("/pricing")({
  beforeLoad: () => {
    throw redirect({ href: "/services", statusCode: 301 });
  },
});
