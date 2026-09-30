import { createFileRoute } from "@tanstack/react-router";
import { AuthorOffers } from "@/components/site/AuthorOffers";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/services/")({
  head: () =>
    buildSeo(
      {
        title: "Services — What HQ360 Does | HQ360",
        description:
          "Writing, editing, formatting, publishing support, author visibility, websites and email systems.",
        path: "/services",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
      ]),
    ),
  component: () => (
    <Section>
      <SectionHeader
        as="h1"
        title="Services for your next chapter"
        intro="Choose the support you need, wherever you are in your author journey."
      />
      <AuthorOffers />
    </Section>
  ),
});
