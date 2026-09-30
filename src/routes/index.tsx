import { createFileRoute } from "@tanstack/react-router";
import { HomeExperience } from "@/components/site/home/HomeExperience";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    buildSeo({
      title: "HQ360 — Book & Marketing Support for Authors",
      description:
        "Book writing, editing, formatting, publishing support, author visibility, websites and email systems for authors and publishers.",
      path: "/",
    }),
  component: HomeExperience,
});
