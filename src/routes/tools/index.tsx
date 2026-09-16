import { createFileRoute, Link } from "@tanstack/react-router";
import { FREE_TOOLS } from "@/data/free-tools";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { buildSeo } from "@/lib/seo";
export const Route = createFileRoute("/tools/")({
  head: () =>
    buildSeo({
      title: "Free Business & Author Tools | HQ360",
      description: "Practical checklists, briefs and planners for your next stage of growth.",
      path: "/tools",
    }),
  component: Tools,
});
function Tools() {
  return (
    <Section>
      <SectionHeader
        as="h1"
        eyebrow="HQ360 / Resources"
        title="A useful place to start."
        intro="Explore free tools to clarify your idea, review your foundations and plan your next move."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FREE_TOOLS.map((t) => (
          <Link
            key={t.slug}
            to={`/tools/${t.slug}`}
            className="rounded-2xl border border-border bg-card p-7 transition hover:border-brand"
          >
            <h2 className="font-display text-xl">{t.name}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{t.description}</p>
            <span className="mt-6 block text-sm font-semibold text-brand">Open tool →</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
