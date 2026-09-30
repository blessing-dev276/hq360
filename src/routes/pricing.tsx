import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader, ButtonLink } from "@/components/site/Primitives";
import { FaqSection } from "@/components/site/FaqSection";
import { CtaBand } from "@/components/site/CtaBand";
import { Packages } from "@/components/site/hqd/Packages";
import { CARE_PLAN, PLANS } from "@/data/pricing";
import { buildSeo, breadcrumbSchema, faqSchema } from "@/lib/seo";

const lowest = PLANS.map((plan) => plan.price).sort(
  (a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")),
)[0];

const PRICING_FAQS = [
  {
    q: "Are these prices final?",
    a: "They’re starting prices. After a short brief we send a written scope with the exact price, timeline and what’s included — before any work begins.",
  },
  {
    q: "What if I need a mobile app or something bigger?",
    a: "Mobile apps, larger websites, writing, editing and translation are quoted individually after a short brief, so you only pay for what the project actually needs.",
  },
  {
    q: "Is there a monthly fee?",
    a: `No — the packages are one-time. If you’d like ongoing help after launch, care plans start from ${CARE_PLAN.price}${CARE_PLAN.cadence}.`,
  },
  {
    q: "Which currency do you charge in?",
    a: "Prices are shown and invoiced in US dollars.",
  },
];

export const Route = createFileRoute("/pricing")({
  head: () =>
    buildSeo(
      {
        title: "Pricing | HQ360",
        description: `Affordable website, CRM and author packages from ${lowest}. Written scope and price before any work begins.`,
        path: "/pricing",
      },
      [
        faqSchema(PRICING_FAQS),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ]),
      ],
    ),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <Section tone="hero">
        <SectionHeader
          as="h1"
          eyebrow="Pricing"
          title="Great work, fair prices."
          intro={`Simple packages from ${lowest}, with a written scope before any work begins. No surprises, no hidden extras.`}
        />
        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href="#packages">See packages</ButtonLink>
          <ButtonLink to="/contact" variant="secondary">
            Get a custom quote
          </ButtonLink>
        </div>
      </Section>
      <Section id="packages">
        <Packages heading={false} />
      </Section>
      <Section tone="raised">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <SectionHeader
            eyebrow="Questions"
            title="Pricing, answered"
            intro="Everything else is agreed in writing before we start."
          />
          <FaqSection faqs={PRICING_FAQS} idPrefix="pricing" />
        </div>
      </Section>
      <CtaBand
        title="Not sure which package fits?"
        body="Tell us what you need and we’ll recommend the simplest option — or send a custom quote."
        secondary={{ label: "Explore services", to: "/services" }}
      />
    </>
  );
}
