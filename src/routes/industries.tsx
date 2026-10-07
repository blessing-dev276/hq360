import { createFileRoute } from "@tanstack/react-router";
import { AudienceLinks } from "@/components/site/AgencyPages";
import { Section, SectionHeader } from "@/components/site/Primitives";
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
      <Section tone="hero">
        <SectionHeader
          as="h1"
          eyebrow="Who we help"
          title="Different businesses. Specific needs."
          intro="Explore a starting point shaped around your business."
        />
      </Section>
      <Section>
        <AudienceLinks />
      </Section>
    </>
  ),
});
