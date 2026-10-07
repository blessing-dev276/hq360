import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, Section, SectionHeader } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { GLOSSARY } from "@/data/insights-hub";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";
import { BRAND, CTAS } from "@/config/brand";

export const Route = createFileRoute("/insights/glossary")({
  head: () =>
    buildSeo(
      {
        title: "Growth Marketing Glossary | HQ360",
        description:
          "Plain-language definitions of growth, CRO, SEO, advertising, CRM automation and retention terms — from speed to lead to blended acquisition cost.",
        path: "/insights/glossary",
      },
      [
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Insights", path: "/insights" },
          { name: "Glossary", path: "/insights/glossary" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: "HQ360 Growth Marketing Glossary",
          publisher: { "@type": "Organization", name: BRAND.name },
          hasDefinedTerm: GLOSSARY.map((t) => ({
            "@type": "DefinedTerm",
            name: t.term,
            description: t.short,
            url: `${BRAND.siteUrl}/insights/glossary#${t.slug}`,
          })),
        },
      ],
    ),
  component: GlossaryPage,
});

function GlossaryPage() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <>
      <Section tone="hero">
        <Container size="narrow" className="px-0">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/insights" className="hover:text-brand">
              Insights
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">Glossary</span>
          </nav>
          <div className="mt-8">
            <SectionHeader
              as="h1"
              eyebrow="Glossary"
              title="Growth marketing, defined"
              intro="The terms that come up in a growth engagement, in plain language. Link straight to any definition."
            />
          </div>
        </Container>
      </Section>
      <Section>
        <Container size="narrow" className="px-0">
          <dl className="divide-y divide-border">
            {sorted.map((t) => (
              <div key={t.slug} id={t.slug} className="scroll-mt-24 py-7">
                <dt className="font-display text-xl">{t.term}</dt>
                <dd className="mt-2 text-base leading-relaxed text-foreground">{t.short}</dd>
                <dd className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.body}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <CtaBand
        title="Want the system, not just the vocabulary?"
        body="Start a project and we will build the connected version for your business."
        primary={CTAS.primary}
        secondary={CTAS.industries}
      />
    </>
  );
}
