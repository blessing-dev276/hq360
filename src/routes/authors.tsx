import { createFileRoute } from "@tanstack/react-router";
import { AuthorOffers } from "@/components/site/AuthorOffers";
import { Section, SectionHeader, ButtonLink } from "@/components/site/Primitives";
import { PortfolioStrip } from "@/components/site/PortfolioStrip";
import { TestimonialStrip } from "@/components/site/TestimonialStrip";
import { buildSeo } from "@/lib/seo";
export const Route = createFileRoute("/authors")({
  head: () =>
    buildSeo({
      title: "Authors & Publishers | HQ360",
      description:
        "Support to develop, publish and market your book, and build your author platform.",
      path: "/authors",
    }),
  component: () => (
    <>
      <Section>
        <SectionHeader
          as="h1"
          title="Support for every stage of your book"
          intro="Start with the help you need now. We agree a focused scope around your manuscript, publishing plans or reader relationships."
        />
        <AuthorOffers />
      </Section>
      <PortfolioStrip industry="authors" />
      <Section tone="raised">
        <SectionHeader
          title="Preparing for a launch?"
          intro="Bring your book positioning, author platform and launch activity into one agreed plan."
        />
        <div className="mt-6">
          <ButtonLink to="/book-launch">Explore book launch support</ButtonLink>
        </div>
      </Section>
      <TestimonialStrip industry="authors" />
    </>
  ),
});
