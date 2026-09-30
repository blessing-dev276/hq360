import { readInquiryContext } from "@/lib/inquiry-context";
import { getCoreService, SERVICE_REDIRECTS } from "@/data/agency";
import { CoreServicePage } from "@/components/site/AgencyPages";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getCapability } from "@/data/capabilities";
import { getAuthorOffer } from "@/data/author-offers";
import { AuthorOfferPage } from "@/components/site/AuthorOffers";
import { capabilityHead } from "@/lib/page-heads";
import { buildSeo } from "@/lib/seo";
import { CapabilityDetailView } from "./capabilities.$slug";

export const Route = createFileRoute("/services/$slug")({
  validateSearch: readInquiryContext,
  beforeLoad: ({ params }) => {
    const slug = SERVICE_REDIRECTS[params.slug];
    if (slug) throw redirect({ to: "/services/$slug", params: { slug }, statusCode: 301 });
  },
  loader: ({ params }) => {
    const service = getCoreService(params.slug);
    if (service) return { service, offer: null, capability: null };
    const offer = getAuthorOffer(params.slug);
    if (offer) return { offer, capability: null, service: null };
    const capability = getCapability(params.slug);
    if (!capability) throw notFound();
    return { capability, offer: null, service: null };
  },
  head: ({ loaderData }) =>
    loaderData?.service
      ? buildSeo({
          title: `${loaderData.service.name} | HQ360`,
          description: loaderData.service.description,
          path: `/services/${loaderData.service.slug}`,
        })
      : loaderData?.offer
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
  const { capability, offer, service } = Route.useLoaderData();
  const context = Route.useSearch();
  if (service)
    return (
      <CoreServicePage
        key={`${service.slug}:${context.audience}`}
        service={service}
        audience={context.audience}
        sourcePath={context.from || `/services/${service.slug}`}
      />
    );
  if (offer) return <AuthorOfferPage offer={offer} />;
  return <CapabilityDetailView capability={capability} />;
}
