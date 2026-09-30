import { createFileRoute } from "@tanstack/react-router";
import { AudiencePage } from "@/components/site/AgencyPages";
import { getAudience } from "@/data/agency";
import { buildSeo } from "@/lib/seo";
const audience = getAudience("ugc-creators")!;
export const Route = createFileRoute("/ugc-creators")({
  head: () =>
    buildSeo({
      title: `${audience.name} | HQ360`,
      description: audience.intro,
      path: "/ugc-creators",
    }),
  component: () => <AudiencePage audience={audience} />,
});
