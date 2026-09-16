import { createFileRoute } from "@tanstack/react-router";
import { TeamExperience } from "@/components/site/TeamExperience";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/team")({
  head: () =>
    buildSeo(
      {
        title: "Meet the Team | HQ360",
        description:
          "The multidisciplinary team behind HQ360 — one named lead per engagement, every discipline in-house.",
        path: "/team",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Team", path: "/team" },
      ]),
    ),
  component: TeamPage,
});

function TeamPage() {
  return <TeamExperience />;
}
