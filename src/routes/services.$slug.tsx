import { createFileRoute, notFound } from "@tanstack/react-router";
import { getCapability, type Capability } from "@/data/capabilities";
import { capabilityHead } from "@/lib/page-heads";
import { buildSeo } from "@/lib/seo";
import { CapabilityDetailView } from "./capabilities.$slug";

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }): { capability: Capability } => {
    const capability = getCapability(params.slug);
    if (!capability) throw notFound();
    return { capability };
  },
  head: ({ loaderData }) =>
    loaderData
      ? capabilityHead(loaderData.capability)
      : buildSeo({ title: "Service not found | HQ360", description: "This service could not be found.", path: "/services", noindex: true }),
  component: ServiceDetail,
});

function ServiceDetail() {
  const { capability } = Route.useLoaderData();
  return <CapabilityDetailView capability={capability} />;
}
