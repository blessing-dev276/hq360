import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/site/Primitives";
import { MarketingHero } from "@/components/site/MarketingHero";
import { ServiceLinks } from "@/components/site/AgencyPages";
import { Packages } from "@/components/site/hqd/Packages";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo } from "@/lib/seo";
export const Route = createFileRoute("/services/")({
  head: () =>
    buildSeo({
      title: "Services | HQ360 SPACE",
      description:
        "Website development, mobile apps, automation and CRM, writing and editing, translation and localization.",
      path: "/services",
    }),
  component: () => (
    <>
      <MarketingHero
        eyebrow="HQ360 / Services"
        title="Services for the work you need done"
        description="Start with one clear brief or combine services in an agreed project scope."
        primary={{ label: "Start a project", href: "/contact" }}
        secondary={{ label: "Explore our services", href: "#services" }}
        highlights={["Websites & apps", "Systems & automation", "Content & marketing"]}
      />
      <Section id="services" className="scroll-mt-28">
        <ServiceLinks />
      </Section>
      <Section tone="raised">
        <Packages />
      </Section>
      <CtaBand
        title="Not sure where to start?"
        body="Send a short brief and we’ll recommend the simplest way forward."
        secondary={{ label: "See pricing", to: "/pricing" }}
      />
    </>
  ),
});
