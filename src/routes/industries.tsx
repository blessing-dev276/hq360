import { createFileRoute } from "@tanstack/react-router";
import { AudienceLinks } from "@/components/site/AgencyPages";
import { Section } from "@/components/site/Primitives";
import { MarketingHero } from "@/components/site/MarketingHero";
import { buildSeo } from "@/lib/seo";
export const Route = createFileRoute("/industries")({
  head: () =>
    buildSeo({
      title: "Who We Help | HQ360",
      description:
        "Practical support for authors, creators, agencies, cleaning businesses, appointment-based businesses and local businesses.",
      path: "/industries",
    }),
  component: () => (
    <>
      <MarketingHero
        eyebrow="HQ360 / Who we help"
        title="Different businesses. Specific needs."
        description="Explore a starting point shaped around your business."
        primary={{ label: "Start a project", href: "/contact" }}
        secondary={{ label: "Find your industry", href: "#industries" }}
        highlights={["Authors & creators", "Agencies & teams", "Local & service businesses"]}
      />
      <Section id="industries" className="scroll-mt-28">
        <AudienceLinks />
      </Section>
    </>
  ),
});
