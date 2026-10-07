import { AuthorExperience } from "@/components/site/home/AuthorExperience";
import { createFileRoute } from "@tanstack/react-router";
import { buildSeo } from "@/lib/seo";
export const Route = createFileRoute("/authors")({
  head: () =>
    buildSeo({
      title: "Authors & Publishers | HQ360",
      description:
        "Support to develop, publish and market your book, and build your author platform.",
      path: "/authors",
    }),
  component: AuthorExperience,
});
