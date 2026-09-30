import { createFileRoute } from "@tanstack/react-router";
import { HomeExperience } from "@/components/site/home/HomeExperience";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    buildSeo({
      title: "HQ360 SPACE — Websites, Apps, Automation & Content",
      description:
        "Website and mobile app development, automation and CRM, writing and editing, translation and localization for businesses.",
      path: "/",
    }),
  component: HomeExperience,
});
