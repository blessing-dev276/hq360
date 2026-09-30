import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { AgencyWork } from "@/components/site/AgencyWork";
import { TestimonialStrip } from "@/components/site/TestimonialStrip";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/work/")({
  head: () =>
    buildSeo(
      {
        title: "Work & Case Studies | HQ360",
        description:
          "Published HQ360 projects across websites, author marketing and publishing support, labelled by service and audience.",
        path: "/work",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Work", path: "/work" },
      ]),
    ),
  component: WorkPage,
});

function WorkPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Our work"
          title="Selected projects, with the work explained"
          intro="Explore published websites, author campaigns and publishing work. Filter by service or audience to find relevant examples."
        />
        <AgencyWork filters />
      </Section>
      <TestimonialStrip />
      <CtaBand
        title="What are you working on?"
        body="Tell us what you need, and we’ll agree the scope and next steps."
        primary={CTAS.primary}
        secondary={{ label: "Explore services", to: "/services" }}
      />
    </>
  );
}
