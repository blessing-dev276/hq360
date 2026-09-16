import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { WorkGrid } from "@/components/site/WorkGrid";
import { ProofStrip } from "@/components/site/ProofStrip";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";
import { loadCaseStudies } from "@/lib/case-studies.functions";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/work/")({
  loader: () => loadCaseStudies({ data: {} }),
  head: () =>
    buildSeo(
      {
        title: "Work & Case Studies | HQ360",
        description:
          "Selected HQ360 projects and the way we structure growth engagements. Real work is labelled as such; illustrative engagements are marked.",
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
  const { studies } = Route.useLoaderData();
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          align="center"
          eyebrow="Work"
          title="The work, and the way it is built"
          intro="A growing set of projects, plus a few engagements shown as illustrative structures while the client-approved case studies are being written. Nothing here presents a number as a result unless it is real and checkable."
        />
        <div className="mt-12">
          <WorkGrid initialStudies={studies} />
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeader
          eyebrow="Proof of work"
          title="Client reviews and campaign footage"
          intro="Supplied by clients. No fabricated quotes or figures."
        />
        <div className="mt-10">
          <ProofStrip />
        </div>
      </Section>

      <CtaBand
        title="Want to see a plan for your business?"
        body="The fastest way to understand how we work is to see what we would do for you. Start a project and we will map it."
        primary={CTAS.primary}
        secondary={CTAS.industries}
      />
    </>
  );
}
