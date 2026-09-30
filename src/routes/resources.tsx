import { createFileRoute } from "@tanstack/react-router";
import { InsightsHub } from "./insights.index";
import { buildSeo } from "@/lib/seo";
export const Route = createFileRoute("/resources")({
  head: () =>
    buildSeo({
      title: "Resources | HQ360",
      description: "Explore guides, articles, answers, glossary and downloadable resources.",
      path: "/resources",
    }),
  component: InsightsHub,
});
