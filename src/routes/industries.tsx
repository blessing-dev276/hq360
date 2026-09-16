import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { IndustryGrid } from "@/components/site/IndustryGrid";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/industries")({
  head: () =>
    buildSeo(
      {
        title: "Industries We Build Growth Systems For | HQ360",
        description:
          "HQ360 builds growth systems around your industry — authors, real estate, creators, coaches, home services, professional services, agencies and local business.",
        path: "/industries",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Industries", path: "/industries" },
      ]),
    ),
  component: IndustriesPage,
});

function IndustriesPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          align="center"
          eyebrow="Who we help"
          title="Built around your industry"
          intro="Every landing below is a real system, not a template with the name swapped. The plumbing page talks about after-hours response; the coaching page talks about qualified calls. Pick the one that sounds like your business."
        />
        <div className="mt-14">
          <IndustryGrid grouped />
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          Not listed? The framework adapts to most industries.{" "}
          <a href="/contact" className="text-brand underline underline-offset-4">
            Tell us about yours
          </a>
          .
        </p>
      </Section>

      <CtaBand
        title="Not sure which system fits?"
        body="Send us a line about the business. We will point you to the closest starting point and tell you what we would build first."
        primary={CTAS.primary}
        secondary={CTAS.work}
      />
    </>
  );
}
