import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { CAPABILITIES, getCapability, type Capability } from "@/data/capabilities";
import { INDUSTRIES } from "@/data/industries";
import { Container, Eyebrow, Section, SectionHeader } from "@/components/site/Primitives";
import { OrbitGraphic } from "@/components/brand/OrbitGraphic";
import { OutcomeCards } from "@/components/site/OutcomeCards";
import { ProcessTimeline } from "@/components/site/ProcessTimeline";
import { FaqSection } from "@/components/site/FaqSection";
import { Reveal } from "@/components/site/Reveal";
import { PortfolioStrip } from "@/components/site/PortfolioStrip";
import { CtaBand } from "@/components/site/CtaBand";
import { capabilityHead } from "@/lib/page-heads";
import { buildSeo } from "@/lib/seo";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/capabilities/$slug")({
  beforeLoad: ({ params }) => {
    const capability = getCapability(params.slug);
    if (!capability) throw notFound();
    throw redirect({ href: capability.path, statusCode: 301 });
  },
  loader: ({ params }): { capability: Capability } => {
    const capability = getCapability(params.slug);
    if (!capability) throw notFound();
    return { capability };
  },
  head: ({ loaderData }) =>
    loaderData
      ? capabilityHead(loaderData.capability)
      : buildSeo({
          title: "Service not found | HQ360",
          description: "This service could not be found.",
          path: "/services",
          noindex: true,
        }),
  component: CapabilityDetail,
});

function CapabilityDetail() {
  const { capability } = Route.useLoaderData();
  return <CapabilityDetailView capability={capability} />;
}

export function CapabilityDetailView({ capability }: { capability: Capability }) {
  const others = CAPABILITIES.filter((c) => c.slug !== capability.slug);
  const relatedIndustries = INDUSTRIES.filter((i) =>
    i.recommendedCapabilities.includes(capability.slug),
  ).slice(0, 5);

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-20 hidden h-[26rem] w-[26rem] text-foreground/[0.06] lg:block"
        >
          <OrbitGraphic />
        </span>
        <Container className="relative py-16 sm:py-20 lg:py-24">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/services" className="hover:text-brand">
              Services
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{capability.name}</span>
          </nav>
          <div className="mt-8 max-w-3xl">
            <Eyebrow>Service</Eyebrow>
            <h1 className="mt-4 text-4xl leading-[1.08] text-balance sm:text-5xl">
              {capability.name}
            </h1>
            <div className="rule-brand mt-6" />
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {capability.tagline}
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {capability.summary}
            </p>
            <Link
              to={CTAS.primary.to}
              className="mt-9 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              {CTAS.primary.label}
            </Link>
          </div>
        </Container>
      </section>

      <Section tone="raised">
        <SectionHeader eyebrow="What you get" title="Outcomes, not tools" />
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
