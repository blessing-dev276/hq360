import { Link } from "@tanstack/react-router";
import type { Capability } from "@/data/capabilities";
import { CAPABILITIES } from "@/data/capabilities";
import { INDUSTRIES } from "@/data/industries";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { MarketingHero } from "@/components/site/MarketingHero";
import { inquiryHref } from "@/lib/inquiry-context";
import { OutcomeCards } from "@/components/site/OutcomeCards";
import { ProcessTimeline } from "@/components/site/ProcessTimeline";
import { FaqSection } from "@/components/site/FaqSection";
import { Reveal } from "@/components/site/Reveal";
import { PortfolioStrip } from "@/components/site/PortfolioStrip";
import { CtaBand } from "@/components/site/CtaBand";
import { CTAS } from "@/config/brand";

// Shared by /capabilities/$slug and /services/$slug. Lives outside the route
// files so neither route's config (which sits in the shared bundle) pulls in
// this page's code and the industries data it uses.
export function CapabilityDetailView({ capability }: { capability: Capability }) {
  const others = CAPABILITIES.filter((c) => c.slug !== capability.slug);
  const relatedIndustries = INDUSTRIES.filter((i) =>
    i.recommendedCapabilities.includes(capability.slug),
  ).slice(0, 5);

  return (
    <>
      <MarketingHero
        eyebrow="HQ360 / Services"
        title={capability.name}
        description={capability.tagline}
        primary={{
          label: "Start a project",
          href: inquiryHref({ from: `/services/${capability.slug}` }),
        }}
        secondary={{ label: "Explore the service", href: "#service-details" }}
        highlights={["Strategy through delivery", "One connected team", "A clear project scope"]}
      />

      <Section id="service-details" tone="raised" className="scroll-mt-28">
        <SectionHeader
          eyebrow="What you get"
          title="Outcomes, not tools"
          intro={capability.summary}
        />
        <div className="mt-10">
          <OutcomeCards items={capability.outcomes} />
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="The work" title={`Inside ${capability.name}`} />
        <ul className="mt-12 grid gap-5 md:grid-cols-2">
          {capability.services.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 30} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                  <h3 className="font-display text-lg">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-border bg-card p-7">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Typical deliverables
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {capability.deliverables.map((d) => (
              <li key={d} className="flex gap-2.5 text-sm text-foreground">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {relatedIndustries.length > 0 ? (
        <Section tone="raised">
          <SectionHeader eyebrow="Where it applies" title="Industries that lean on this" />
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {relatedIndustries.map((i) => (
              <li key={i.slug}>
                <Link
                  to={i.path}
                  className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-brand hover:text-brand"
                >
                  {i.shortName}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Portfolio (managed from /admin) */}
      <PortfolioStrip
        capability={capability.slug}
        eyebrow="Selected work"
        title="Work in this area"
      />

      <Section>
        <SectionHeader eyebrow="How we run it" title="The same six steps, every engagement" />
        <ProcessTimeline />
      </Section>

      {capability.faqs.length > 0 ? (
        <Section tone="raised">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <SectionHeader eyebrow="Questions" title={`${capability.name}, answered`} />
            <FaqSection faqs={capability.faqs} idPrefix={`cap-${capability.slug}`} />
          </div>
        </Section>
      ) : null}

      <Section>
        <SectionHeader eyebrow="More services" title="The rest of the system" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((c) => (
            <li key={c.slug}>
              <Link
                to={c.path}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 hover:border-brand/50 hover:shadow-lift"
              >
                <h3 className="font-display text-base">{c.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.tagline}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title={`Bring ${capability.name.toLowerCase()} into one system`}
        body="Tell us what is in place today. We will show you how this connects to the rest and what to build first."
        primary={CTAS.primary}
        secondary={CTAS.industries}
      />
    </>
  );
}
