import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy route — "Results" is now the "Work" case-study area.
export const Route = createFileRoute("/results")({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: "/work" });
  },
});
