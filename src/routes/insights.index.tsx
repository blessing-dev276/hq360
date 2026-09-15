import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { Reveal } from "@/components/site/Reveal";
import { CtaBand } from "@/components/site/CtaBand";
import { INSIGHTS } from "@/data/insights";
import { ANSWERS, GLOSSARY, GUIDES, LIBRARY_TOPICS, RESOURCES } from "@/data/insights-hub";
import { buildSeo, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { CTAS } from "@/config/brand";

export const Route = createFileRoute("/insights/")({
  head: () =>
    buildSeo(
      {
        title: "Growth Library: Guides, Answers, Glossary & Resources | HQ360",
        description:
          "Practical guides, quick answers, a glossary and downloads on growth systems, websites, SEO, advertising, automation and retention — from the HQ360 team.",
        path: "/insights",
      },
      [
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Insights", path: "/insights" },
        ]),
        faqSchema(ANSWERS.map((a) => ({ q: a.question, a: a.short }))),
      ],
    ),
  component: InsightsHub,
});

function InsightsHub() {
  const topics = useMemo(() => ["All", ...LIBRARY_TOPICS] as const, []);
  const [topic, setTopic] = useState<string>("All");
  const match = (t: string) => topic === "All" || t === topic;

  const guides = GUIDES.filter((g) => match(g.topic));
  const answers = ANSWERS.filter((a) => match(a.topic));
  const glossary = GLOSSARY.slice(0, 8);
  const articles = INSIGHTS;

  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="The HQ360 growth library"
          title="Answers, playbooks and tools for growing a business"
          intro="Working knowledge from building connected growth systems — no listicles. Guides go deep, answers are quick, the glossary defines the jargon, and the resources are yours to download."
        />

        {/* Content-type quick nav */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Guides", to: "#guides", desc: `${GUIDES.length} in-depth playbooks` },
            { label: "Answers", to: "#answers", desc: `${ANSWERS.length} common questions` },
            { label: "Glossary", to: "#glossary", desc: `${GLOSSARY.length} terms defined` },
            { label: "Resources", to: "#resources", desc: `${RESOURCES.length} downloads` },
          ].map((c) => (
            <a
              key={c.label}
              href={c.to}
              className="group flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand/50"
            >
              <span>
                <span className="block font-display text-base">{c.label}</span>
                <span className="block text-xs text-muted-foreground">{c.desc}</span>
              </span>
              <ArrowRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>

        {/* Topic filter */}
        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          {topics.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              aria-pressed={topic === t}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                topic === t
                  ? "border-transparent bg-charcoal text-[oklch(0.97_0.006_90)]"
                  : "border-border bg-card text-muted-foreground hover:border-brand hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      {/* Guides */}
      <Section id="guides" tone="raised">
        <SectionHeader eyebrow="Guides" title="In-depth playbooks" />
        {guides.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No guides in this topic yet.</p>
        ) : (
          <ul className="mt-10 grid gap-6 lg:grid-cols-2">
            {guides.map((g, i) => (
              <li key={g.slug}>
                <Reveal delay={i * 40} className="h-full">
                  <Link
                    to="/insights/guides/$slug"
                    params={{ slug: g.slug }}
                    className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift"
                  >
                    <span className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                      {g.topic}
                    </span>
                    <h3 className="mt-3 font-display text-xl leading-snug">{g.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {g.summary}
                    </p>
                    <span className="mt-6 text-xs text-muted-foreground">
                      Updated {g.updated} &middot; {g.readTime}
                    </span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Answers */}
      <Section id="answers">
        <SectionHeader
          eyebrow="Answers"
          title="Quick answers to common questions"
          intro="Straight answers to what prospects ask most — no sales pitch."
        />
        {answers.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No answers in this topic yet.</p>
        ) : (
          <ul className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {answers.map((a) => (
              <li key={a.slug}>
                <Link
                  to="/insights/answers/$slug"
                  params={{ slug: a.slug }}
                  className="group flex items-start gap-4 p-5 transition-colors hover:bg-secondary/40 sm:p-6"
                >
                  <span className="mt-0.5 flex-1">
                    <span className="block font-display text-base leading-snug group-hover:text-brand">
                      {a.question}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {a.short}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Glossary */}
      <Section id="glossary" tone="raised">
        <SectionHeader
          eyebrow="Glossary"
          title="The jargon, defined"
          intro="Plain-language definitions of the terms that come up in a growth engagement."
        />
        <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {glossary.map((t) => (
            <div key={t.slug}>
              <dt className="font-display text-base">{t.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.short}</dd>
            </div>
          ))}
        </dl>
        <Link
          to="/insights/glossary"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
        >
          View the full glossary <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Section>

      {/* Resources */}
      <Section id="resources">
        <SectionHeader
          eyebrow="Resources"
          title="Free downloads"
          intro="Templates and checklists we use in engagements. No form wall — the file downloads straight away."
        />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {RESOURCES.map((r, i) => (
            <li key={r.slug}>
              <Reveal delay={i * 40} className="h-full">
                <a
                  href={r.href}
                  download
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-brand/50"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-soft text-[oklch(0.42_0.16_42)]">
                    <Download className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-base leading-snug">{r.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {r.description}
                  </p>
                  <span className="mt-4 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {r.format} &middot; Download
                  </span>
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      {/* Articles */}
      <Section tone="raised">
        <SectionHeader
          eyebrow="Articles"
          title="Notes from building growth systems"
          intro="Shorter essays on what moves the number and what quietly wastes budget."
        />
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((p, i) => (
            <li key={p.slug}>
              <Reveal delay={i * 30} className="h-full">
                <Link
                  to="/insights/$slug"
                  params={{ slug: p.slug }}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift"
                >
                  <span className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                    {p.category}
                  </span>
                  <h3 className="mt-3 font-display text-lg leading-snug">{p.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {p.excerpt}
                  </p>
                  <span className="mt-6 text-xs text-muted-foreground">
                    {p.date} &middot; {p.readTime}
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title="Prefer this applied to your business?"
        body="Start a project and we will turn the thinking into a plan for your specific situation."
        primary={CTAS.primary}
        secondary={CTAS.industries}
      />
    </>
  );
}
