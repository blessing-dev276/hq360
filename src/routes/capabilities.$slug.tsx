import { SERVICE_REDIRECTS } from "@/data/agency";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getCapability, type Capability } from "@/data/capabilities";
import { CapabilityDetailView } from "@/components/site/CapabilityDetailView";
import { capabilityHead } from "@/lib/page-heads";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/capabilities/$slug")({
  beforeLoad: ({ params }) => {
    const capability = getCapability(params.slug);
    if (!capability) throw notFound();
    throw redirect({
      href: SERVICE_REDIRECTS[params.slug]
        ? `/services/${SERVICE_REDIRECTS[params.slug]}`
        : capability.path,
      statusCode: 301,
    });
  },
  loader: ({ params }): { capability: Capability } => {
    const capability = getCapability(params.slug);
    if (!capability) throw notFound();
    return { capability };
  },
  head: ({ loaderData }) =>
    loaderData
      ? capabilityHead(loaderData.capability)
      : buildSeo({
          title: "Service not found | HQ360",
          description: "This service could not be found.",
          path: "/services",
          noindex: true,
        }),
  component: CapabilityDetail,
});

function CapabilityDetail() {
  const { capability } = Route.useLoaderData();
  return <CapabilityDetailView capability={capability} />;
}
