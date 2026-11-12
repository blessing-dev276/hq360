import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old signup links now open the application dialog in the combined directory. */
export const Route = createFileRoute("/expert-signup")({
  beforeLoad: () => {
    throw redirect({ href: "/experts#become-expert", statusCode: 301 });
  },
});
