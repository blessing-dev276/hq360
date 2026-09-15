import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getInsight, INSIGHTS, type Insight } from "@/data/insights";
import { Container, Eyebrow, Section, SectionHeader } from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema, truncateDescription } from "@/lib/seo";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/insights/$slug")({
  loader: ({ params }): { post: Insight } => {
    const post = getInsight(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) =>
    loaderData
      ? buildSeo(
          {
            title: `${loaderData.post.title} | HQ360 Insights`,
            description: truncateDescription(loaderData.post.excerpt),
            path: `/insights/${loaderData.post.slug}`,
            type: "article",
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Insights", path: "/insights" },
            { name: loaderData.post.title, path: `/insights/${loaderData.post.slug}` },
          ]),
        )
      : buildSeo({
          title: "Article not found | HQ360",
          description: "This article could not be found.",
          path: "/insights",
          noindex: true,
        }),
  component: InsightPost,
});

function InsightPost() {
  const { post } = Route.useLoaderData();
  const more = INSIGHTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
      <Section>
        <Container size="narrow" className="px-0">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/insights" className="hover:text-brand">
              Insights
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{post.category}</span>
          </nav>
          <article className="mt-8">
            <Eyebrow>{post.category}</Eyebrow>
            <h1 className="mt-4 text-3xl leading-tight text-balance sm:text-4xl">{post.title}</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              {post.date} &middot; {post.readTime}
            </p>
            <div className="rule-brand mt-8" />
            <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground">
              {post.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          </article>
        </Container>
      </Section>

      {more.length > 0 ? (
        <Section tone="raised">
          <SectionHeader eyebrow="Keep reading" title="More insights" />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {more.map((p) => (
              <li key={p.slug}>
                <Link
                  to="/insights/$slug"
                  params={{ slug: p.slug }}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 hover:border-brand/50 hover:shadow-lift"
                >
                  <span className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                    {p.category}
                  </span>
                  <h3 className="mt-2 font-display text-base leading-snug">{p.title}</h3>
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
