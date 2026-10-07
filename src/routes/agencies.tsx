import { createFileRoute } from "@tanstack/react-router";
import { AudiencePage } from "@/components/site/AgencyPages";
import { getAudience } from "@/data/agency";
import { buildSeo } from "@/lib/seo";
const audience = getAudience("agencies")!;
export const Route = createFileRoute("/agencies")({
  head: () =>
    buildSeo({ title: `${audience.name} | HQ360`, description: audience.intro, path: "/agencies" }),
  component: () => <AudiencePage audience={audience} />,
});
