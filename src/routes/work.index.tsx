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
      <Section id="projects" className="pt-10 sm:pt-12 lg:pt-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Work</h1>
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
