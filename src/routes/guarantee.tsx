import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy route removed in the rebrand. How we work is covered on About and
// each engagement's written scope; commercial terms live on Terms.
export const Route = createFileRoute("/guarantee")({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: "/about" });
  },
});
