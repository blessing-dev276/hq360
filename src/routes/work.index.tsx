import { MarketingHero } from "@/components/site/MarketingHero";
import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/site/Primitives";
import { AgencyWork } from "@/components/site/AgencyWork";
import { ExpertVoices } from "@/components/site/ExpertVoices";
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
      <MarketingHero
        eyebrow="Our work"
        title={
          <>
            Ideas made real.
            <br />
            <em>Work that speaks.</em>
          </>
        }
        description="Explore published websites, author campaigns and publishing work. Filter by service or audience to find relevant examples."
        primary={{ label: "Explore projects", href: "#projects" }}
        secondary={{ label: "Start a project", href: "/contact" }}
      />
      <Section id="projects">
        <AgencyWork filters />
        <ExpertVoices />
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
