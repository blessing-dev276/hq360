import { createFileRoute, redirect } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { CapabilityGrid } from "@/components/site/CapabilityGrid";
import { GrowthFrameworkStrip } from "@/components/site/GrowthFrameworkStrip";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/capabilities/")({
  beforeLoad: () => {
    throw redirect({ statusCode: 301, to: "/services" });
  },
  head: () =>
    buildSeo(
      {
        title: "Services — What HQ360 Does | HQ360",
        description:
          "Eight services: brand and creative, website and funnel, SEO, AI video, social media marketing, digital marketing, mobile app development and game development.",
        path: "/services",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
      ]),
    ),
  component: CapabilitiesPage,
});

export function CapabilitiesPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          align="center"
          eyebrow="What we do"
          title="Nine services, run as one system"
          intro="HQ360 helps businesses and personal brands connect brand, websites, marketing and product development. Start with the services your business needs, guided by an audit and a written plan."
        />
        <div className="mt-14">
          <CapabilityGrid />
        </div>
      </Section>

      <Section tone="carbon">
        <SectionHeader
          tone="light"
          eyebrow="The 360"
          title="Where each service fits"
          intro="A business moves through stages as it grows. Each service owns part of the loop."
        />
        <div className="mt-12">
          <GrowthFrameworkStrip tone="light" />
        </div>
      </Section>

      <CtaBand
        title="Tell us where the system is leaking"
        body="Most engagements start by fixing the weakest stage, not rebuilding everything. Send us a line and we will tell you where we would start."
        primary={CTAS.primary}
        secondary={CTAS.industries}
      />
    </>
  );
}
