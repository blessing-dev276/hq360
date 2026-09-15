import { createFileRoute } from "@tanstack/react-router";
import { Eyebrow, Section, SectionHeader } from "@/components/site/Primitives";
import { FeaturedAuthor } from "@/components/site/FeaturedAuthor";
import { CtaBand } from "@/components/site/CtaBand";
import { LAUNCH, LAUNCH_COVERS, LAUNCH_GALLERY } from "@/data/launch";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/book-launch")({
  head: () =>
    buildSeo(
      {
        title: "Sanman Thapa Book Launch | HQ360",
        description:
          "Photographs and a cover-reveal film from Sanman Thapa's book launch, published with Arti Facts Publishing and delivered with HQ360.",
        path: "/book-launch",
        type: "article",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Authors", path: "/authors" },
        { name: "Sanman Thapa book launch", path: "/book-launch" },
      ]),
    ),
  component: BookLaunchPage,
});

function BookLaunchPage() {
  return (
    <>
      <FeaturedAuthor />

      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Book launch"
          title="Sanman Thapa book launch"
          intro={LAUNCH.intro}
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <div className="overflow-hidden rounded-2xl border border-border bg-charcoal shadow-editorial">
              <video
                src={LAUNCH.video.src}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-charcoal"
              >
                Your browser does not support embedded video.
              </video>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{LAUNCH.video.title}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-editorial">
            <Eyebrow>The title</Eyebrow>
            <h2 className="mt-3 font-display text-2xl leading-snug">{LAUNCH.book}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {LAUNCH.author} &middot; {LAUNCH.publisher}
            </p>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              A novella about attention, silence and the fragile architecture of longing, set in
              1990s Kathmandu.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeader eyebrow="The book" title="Cover and print" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LAUNCH_COVERS.map((c) => (
            <li key={c.src} className="overflow-hidden rounded-2xl border border-border bg-card">
              <img src={c.src} alt={c.alt} loading="lazy" className="w-full object-cover" />
              <p className="px-6 py-4 text-sm text-muted-foreground">{c.caption}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHeader eyebrow="Launch day" title="Photographs from the room" />
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {LAUNCH_GALLERY.map((g) => (
            <li
              key={g.src}
              className={
                "overflow-hidden rounded-2xl border border-border bg-card" +
                (g.wide ? " md:col-span-2" : "")
              }
            >
              <img src={g.src} alt={g.alt} loading="lazy" className="w-full object-cover" />
              <p className="px-6 py-4 text-sm text-muted-foreground">{g.caption}</p>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        eyebrow="Authors & Publishers"
        title="Want a launch that looks like this?"
        body="The Authors & Publishers vertical covers the listing, the launch and the platform that keeps a book selling afterward."
        primary={{ label: "Build my author growth system", to: "/authors" }}
        secondary={{ label: "Start a project", to: "/contact" }}
      />
    </>
  );
}
