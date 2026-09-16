import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { FaqSection } from "@/components/site/FaqSection";
import { GENERAL_FAQS } from "@/data/faqs";
import { buildSeo, breadcrumbSchema, faqSchema } from "@/lib/seo";

export const Route = createFileRoute("/faqs")({
  head: () =>
    buildSeo(
      {
        title: "HQ360 FAQs — Services, Clients & Project Process",
        description:
          "Learn what HQ360 offers, which businesses it helps, how projects work and how to start with the services your business needs.",
        path: "/faqs",
      },
      [
        faqSchema(GENERAL_FAQS),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "FAQs", path: "/faqs" },
        ]),
      ],
    ),
  component: FaqPage,
});

function FaqPage() {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <SectionHeader
            as="h1"
            eyebrow="Questions"
            title="Working with HQ360"
            intro="What we offer, who we help and how to get started."
          />
          <nav
            aria-label="Explore HQ360"
            className="mt-8 flex flex-wrap gap-5 text-sm text-brand underline underline-offset-4"
          >
            <Link to="/services">Explore services</Link>
            <Link to="/industries">Industries we help</Link>
            <Link to="/contact">Start a project</Link>
          </nav>
        </div>
        <FaqSection faqs={GENERAL_FAQS} idPrefix="general" />
      </div>
    </Section>
  );
}
