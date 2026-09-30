import { createFileRoute } from "@tanstack/react-router";
import { AudiencePage } from "@/components/site/AgencyPages";
import { getAudience } from "@/data/agency";
import { buildSeo } from "@/lib/seo";
const audience = getAudience("appointment-based-businesses")!;
export const Route = createFileRoute("/appointment-based-businesses")({
  head: () =>
    buildSeo({
      title: `${audience.name} | HQ360`,
      description: audience.intro,
      path: "/appointment-based-businesses",
    }),
  component: () => <AudiencePage audience={audience} />,
});
