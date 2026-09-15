import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getCapability } from "@/data/capabilities";
import {
  Container,
  Eyebrow,
  SampleBadge,
  Section,
  SectionHeader,
} from "@/components/site/Primitives";
import { CtaBand } from "@/components/site/CtaBand";
import { buildSeo, breadcrumbSchema, truncateDescription } from "@/lib/seo";
import { CTAS } from "@/config/brand";
import { loadCaseStudies } from "@/lib/case-studies.functions";

export const Route = createFileRoute("/work/$slug")({
  loader: async ({ params }) => {
    const result = await loadCaseStudies({ data: { slug: params.slug } });
    const study = result.studies[0];
    if (!study) {
      if (!result.available) throw new Error("Project temporarily unavailable. Please try again.");
      throw notFound();
    }
    return { study, studies: result.studies };
  },
  head: ({ loaderData }) =>
    loaderData?.study
      ? buildSeo(
          {
            title: `${loaderData.study.title} | HQ360 Work`,
            description: truncateDescription(loaderData.study.summary),
            path: `/work/${loaderData.study.slug}`,
            type: "article",
            noindex: loaderData.study.status === "sample",
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Work", path: "/work" },
            { name: loaderData.study.title, path: `/work/${loaderData.study.slug}` },
          ]),
        )
      : buildSeo({
          title: "Project unavailable | HQ360",
          description: "This project could not be loaded.",
          noindex: true,
          path: "/work",
        }),
  component: WorkDetail,
});

function WorkDetail() {
  const { study, studies } = Route.useLoaderData();
  const others = studies.filter((c) => c.slug !== study.slug).slice(0, 2);

  return (
    <>
      <Section>
        <Container size="narrow" className="px-0">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/work" className="hover:text-brand">
              Work
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{study.industry}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Eyebrow>{study.industry}</Eyebrow>
            {study.status === "sample" ? (
              <SampleBadge />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground/60" />
                Verified project
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl leading-tight text-balance sm:text-4xl">{study.title}</h1>
          <p className="mt-3 text-muted-foreground">{study.client}</p>
          <div className="rule-brand mt-6" />
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{study.summary}</p>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {study.capabilities.map((slug) => {
              const cap = getCapability(slug);
              return cap ? (
                <Link
                  key={slug}
                  to={cap.path}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/70 hover:border-brand hover:text-brand"
                >
                  {cap.label}
                </Link>
              ) : null;
            })}
          </div>
        </Container>
      </Section>

      {study.media && study.media.length > 0 ? (
        <Section tone="raised" className="pt-0 lg:pt-0">
          <ul className="grid gap-6 md:grid-cols-2">
            {study.media.map((m, i) => {
              const isVideo =
                (m as { type?: string }).type === "video" || /\.(mp4|webm|mov)$/i.test(m.src);
              return (
                <li
                  key={m.src}
                  className={
                    "overflow-hidden rounded-2xl border border-border bg-card" +
                    (i === 0 ? " md:col-span-2" : "")
                  }
                >
                  {isVideo ? (
                    <video
                      src={m.src}
                      controls
                      playsInline
                      preload="metadata"
                      className="aspect-video w-full bg-charcoal"
                    >
                      Your browser does not support embedded video.
                    </video>
                  ) : (
                    <img src={m.src} alt={m.alt} loading="lazy" className="w-full object-cover" />
                  )}
                  {m.caption ? (
                    <p className="px-5 py-3 text-sm text-muted-foreground">{m.caption}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section>
        <Container size="narrow" className="px-0">
          <div className="space-y-10">
            <Block title="The challenge">
              <p>{study.challenge}</p>
            </Block>
            <Block title="What we did">
              <ul className="space-y-2">
                {study.approach.map((a) => (
                  <li key={a} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-brand"
                    />
                    {a}
                  </li>
                ))}
              </ul>
            </Block>
            <Block title="Deliverables">
              <ul className="grid gap-2 sm:grid-cols-2">
                {study.deliverables.map((d) => (
                  <li key={d} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-brand"
                    />
                    {d}
                  </li>
                ))}
              </ul>
            </Block>
            <Block title="Outcome">
              <p>{study.outcome}</p>
              {study.metrics && study.metrics.length > 0 ? (
                <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                  {study.metrics.map((m) => (
                    <div key={m.label} className="rounded-2xl border border-border bg-card p-5">
                      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                        {m.label}
                      </dt>
                      <dd className="mt-1 font-display text-xl">{m.value}</dd>
                      {m.note ? (
                        <dd className="mt-1 text-xs text-muted-foreground">{m.note}</dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              ) : null}
            </Block>

            {study.testimonial ? (
              <blockquote className="rounded-2xl border-l-2 border-brand bg-secondary/60 p-6">
                <p className="font-display text-lg leading-relaxed">
                  &ldquo;{study.testimonial.quote}&rdquo;
                </p>
                <footer className="mt-3 text-sm text-muted-foreground">
                  {study.testimonial.name}, {study.testimonial.role}
                </footer>
              </blockquote>
            ) : null}
          </div>
        </Container>
      </Section>

      {others.length > 0 ? (
        <Section tone="raised">
          <SectionHeader eyebrow="More work" title="Keep looking" />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  to="/work/$slug"
                  params={{ slug: o.slug }}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 hover:border-brand/50 hover:shadow-lift"
                >
                  <span className="text-xs tracking-wide text-muted-foreground uppercase">
                    {o.industry}
                  </span>
                  <h3 className="mt-2 font-display text-lg">{o.title}</h3>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <CtaBand
        title="Start your project"
        body="Tell us what you are working on. We reply within one working day with a first view of what we would do."
        primary={CTAS.primary}
        secondary={CTAS.industries}
      />
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
