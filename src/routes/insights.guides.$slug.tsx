import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";
import { getGuide, getAnswer, GUIDES, type Guide } from "@/data/insights-hub";
import { Container, Eyebrow, Section, SectionHeader } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema, truncateDescription } from "@/lib/seo";
import { BRAND } from "@/config/brand";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/insights/guides/$slug")({
  loader: ({ params }): { guide: Guide } => {
    const guide = getGuide(params.slug);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ loaderData }) =>
    loaderData
      ? buildSeo(
          {
            title: `${loaderData.guide.title} | HQ360 Guide`,
            description: truncateDescription(loaderData.guide.summary),
            path: `/insights/guides/${loaderData.guide.slug}`,
            type: "article",
          },
          [
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Insights", path: "/insights" },
              { name: "Guides", path: "/insights#guides" },
              {
                name: loaderData.guide.title,
                path: `/insights/guides/${loaderData.guide.slug}`,
              },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: loaderData.guide.title,
              description: loaderData.guide.summary,
              author: { "@type": "Organization", name: BRAND.name },
              publisher: { "@type": "Organization", name: BRAND.name },
              dateModified: loaderData.guide.updated,
              articleSection: loaderData.guide.topic,
            },
          ],
        )
      : buildSeo({
          title: "Guide not found | HQ360",
          description: "This guide could not be found.",
          path: "/insights",
          noindex: true,
        }),
  component: GuidePage,
});

function GuidePage() {
  const { guide } = Route.useLoaderData();
  const answers = (guide.answers ?? [])
    .map((s) => getAnswer(s))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const more = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <>
      <Section>
        <Container size="narrow" className="px-0">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/insights" className="hover:text-brand">
              Insights
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">Guide</span>
          </nav>

          <article className="mt-8">
            <Eyebrow>{guide.topic}</Eyebrow>
            <h1 className="mt-4 text-3xl leading-tight text-balance sm:text-4xl">{guide.title}</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Updated {guide.updated} &middot; {guide.readTime}
            </p>
            <div className="rule-brand mt-8" />

            <p className="mt-8 text-lg leading-relaxed text-muted-foreground">{guide.intro}</p>

            {/* Contents */}
            <nav
              aria-label="On this page"
              className="mt-10 rounded-2xl border border-border bg-card p-5"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                On this page
              </p>
              <ol className="mt-3 space-y-1.5 text-sm">
                {guide.sections.map((s, i) => (
                  <li key={s.heading}>
                    <a
                      href={`#s-${i}`}
                      className="text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-10 space-y-12">
              {guide.sections.map((s, i) => (
                <section key={s.heading} id={`s-${i}`} className="scroll-mt-24">
                  <h2 className="font-display text-2xl">{s.heading}</h2>
                  <div className="mt-4 space-y-5 text-lg leading-relaxed text-muted-foreground">
                    {s.body.map((p) => (
                      <p key={p.slice(0, 40)}>{p}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Takeaways */}
            <div className="mt-14 rounded-2xl border border-border bg-secondary p-7">
              <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
                What to do with this
              </p>
              <ul className="mt-4 space-y-3">
                {guide.takeaways.map((t) => (
                  <li key={t} className="flex gap-3 text-sm leading-relaxed text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {answers.length > 0 ? (
              <div className="mt-10">
                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Related answers
                </p>
                <ul className="mt-3 space-y-2">
                  {answers.map((a) => (
                    <li key={a.slug}>
                      <Link
                        to="/insights/answers/$slug"
                        params={{ slug: a.slug }}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand"
                      >
                        {a.question}
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        </Container>
      </Section>

      {more.length > 0 ? (
        <Section tone="raised">
          <SectionHeader eyebrow="Keep reading" title="More guides" />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {more.map((g) => (
              <li key={g.slug}>
                <Link
                  to="/insights/guides/$slug"
                  params={{ slug: g.slug }}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 hover:border-brand/50 hover:shadow-lift"
                >
                  <span className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                    {g.topic}
                  </span>
                  <h3 className="mt-2 font-display text-base leading-snug">{g.title}</h3>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <CtaBand
        title="Turn this into a plan"
        body="Start a project and we will apply the thinking to your business."
        primary={CTAS.primary}
        secondary={CTAS.work}
      />
    </>
  );
}
