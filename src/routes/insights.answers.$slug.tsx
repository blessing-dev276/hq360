import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { ANSWERS, getAnswer, type Answer } from "@/data/insights-hub";
import { Container, Eyebrow, Section, SectionHeader } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema, truncateDescription } from "@/lib/seo";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/insights/answers/$slug")({
  loader: ({ params }): { answer: Answer } => {
    const answer = getAnswer(params.slug);
    if (!answer) throw notFound();
    return { answer };
  },
  head: ({ loaderData }) =>
    loaderData
      ? buildSeo(
          {
            title: `${loaderData.answer.question} | HQ360`,
            description: truncateDescription(loaderData.answer.short),
            path: `/insights/answers/${loaderData.answer.slug}`,
            type: "article",
          },
          [
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Insights", path: "/insights" },
              { name: "Answers", path: "/insights#answers" },
              {
                name: loaderData.answer.question,
                path: `/insights/answers/${loaderData.answer.slug}`,
              },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "QAPage",
              mainEntity: {
                "@type": "Question",
                name: loaderData.answer.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: [loaderData.answer.short, ...loaderData.answer.body].join(" "),
                },
              },
            },
          ],
        )
      : buildSeo({
          title: "Answer not found | HQ360",
          description: "This answer could not be found.",
          path: "/insights",
          noindex: true,
        }),
  component: AnswerPage,
});

function AnswerPage() {
  const { answer } = Route.useLoaderData();
  const related = (answer.related ?? [])
    .map((s) => getAnswer(s))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const more = ANSWERS.filter(
    (a) => a.slug !== answer.slug && !related.some((r) => r.slug === a.slug),
  ).slice(0, 4);

  return (
    <>
      <Section>
        <Container size="narrow" className="px-0">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/insights" className="hover:text-brand">
              Insights
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">Answers</span>
          </nav>

          <article className="mt-8">
            <Eyebrow>{answer.topic}</Eyebrow>
            <h1 className="mt-4 text-3xl leading-tight text-balance sm:text-4xl">
              {answer.question}
            </h1>
            <div className="rule-brand mt-8" />

            <p className="mt-8 text-xl leading-relaxed text-foreground">{answer.short}</p>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted-foreground">
              {answer.body.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </div>

            {related.length > 0 ? (
              <div className="mt-12">
                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Related
                </p>
                <ul className="mt-3 space-y-2">
                  {related.map((a) => (
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
          <SectionHeader eyebrow="More answers" title="Other common questions" />
          <ul className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
            {more.map((a) => (
              <li key={a.slug}>
                <Link
                  to="/insights/answers/$slug"
                  params={{ slug: a.slug }}
                  className="group flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40 sm:p-6"
                >
                  <span className="flex-1">
                    <span className="block font-display text-base leading-snug group-hover:text-brand">
                      {a.question}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {a.short}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-brand"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <CtaBand
        title="Still have a question?"
        body="Tell us about the business. We reply within one working day with a straight answer."
        primary={CTAS.primary}
        secondary={CTAS.industries}
      />
    </>
  );
}
