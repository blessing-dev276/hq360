import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { TeamShowcase } from "@/components/site/TeamShowcase";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    buildSeo(
      {
        title: "About HQ360 | Author & Publishing Support",
        description:
          "Meet the team helping authors develop books, publish and build reader relationships.",
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
          title="A team for your next chapter"
          intro="HQ360 brings writing, publishing support, design and marketing together for authors and publishers. Formerly House of Synergy, we help you move from a book idea to a clearer path to your readers."
        />
      </Section>
      <Section id="team" tone="raised">
        <TeamShowcase title="The people behind HQ360" />
      </Section>
    </>
  );
}
