import { createFileRoute } from "@tanstack/react-router";
import { AudiencePage } from "@/components/site/AgencyPages";
import { getAudience } from "@/data/agency";
import { buildSeo } from "@/lib/seo";
const audience = getAudience("cleaning-businesses")!;
export const Route = createFileRoute("/cleaning-businesses")({
  head: () =>
    buildSeo({
      title: `${audience.name} | HQ360`,
      description: audience.intro,
      path: "/cleaning-businesses",
    }),
  component: () => <AudiencePage audience={audience} />,
});
