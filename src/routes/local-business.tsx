import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/local-business")({
  beforeLoad: () => {
    throw redirect({ to: "/local-businesses", statusCode: 301 });
  },
});
