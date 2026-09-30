import { createFileRoute, notFound } from "@tanstack/react-router";
import { getCapability } from "@/data/capabilities";
import { getAuthorOffer } from "@/data/author-offers";
import { AuthorOfferPage } from "@/components/site/AuthorOffers";
import { capabilityHead } from "@/lib/page-heads";
import { buildSeo } from "@/lib/seo";
import { CapabilityDetailView } from "./capabilities.$slug";

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }) => {
    const offer = getAuthorOffer(params.slug);
    if (offer) return { offer, capability: null };
    const capability = getCapability(params.slug);
    if (!capability) throw notFound();
    return { capability, offer: null };
  },
  head: ({ loaderData }) =>
    loaderData?.offer
      ? buildSeo({
          title: `${loaderData.offer.name} | HQ360`,
          description: loaderData.offer.description,
          path: `/services/${loaderData.offer.slug}`,
        })
      : loaderData?.capability
        ? capabilityHead(loaderData.capability)
        : buildSeo({
            title: "Service not found | HQ360",
            description: "This service could not be found.",
            path: "/services",
            noindex: true,
          }),
  component: ServiceDetail,
});

function ServiceDetail() {
  const { capability, offer } = Route.useLoaderData();
  if (offer) return <AuthorOfferPage offer={offer} />;
  return <CapabilityDetailView capability={capability} />;
}
