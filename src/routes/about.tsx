import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { TeamShowcase } from "@/components/site/TeamShowcase";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    buildSeo(
      {
        title: "About HQ360 | Digital Services & Content",
        description:
          "Meet the HQ360 team working on websites, apps, automation and written content.",
        path: "/about",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ]),
    ),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          title="A team for your next project"
          intro="HQ360 builds websites, mobile apps and automation systems, and provides writing, editing, translation and localization. We work with businesses, creators, authors and other agencies. Formerly House of Synergy, we bring the required work into an agreed scope, with clear review points and handover."
        />
      </Section>
      <Section id="team" tone="raised">
        <TeamShowcase title="The people behind HQ360" />
      </Section>
    </>
  );
}
