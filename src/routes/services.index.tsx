import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { ServiceLinks } from "@/components/site/AgencyPages";
import { buildSeo } from "@/lib/seo";
export const Route = createFileRoute("/services/")({
  head: () =>
    buildSeo({
      title: "Services | HQ360 SPACE",
      description:
        "Website development, mobile apps, automation and CRM, writing and editing, translation and localization.",
      path: "/services",
    }),
  component: () => (
    <Section>
      <SectionHeader
        as="h1"
        title="Services for the work you need done"
        intro="Start with one clear brief or combine services in an agreed project scope."
      />
      <ServiceLinks />
    </Section>
  ),
});
