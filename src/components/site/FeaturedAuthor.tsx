import { Link } from "@tanstack/react-router";
import { Container, Eyebrow } from "@/components/site/Primitives";
import featuredAuthor from "@/assets/featured-author-sanman.jpg";

export function FeaturedAuthor() {
  return (
    <section className="bg-carbon text-[oklch(0.95_0.006_90)]">
      <Container className="py-16 sm:py-20 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="overflow-hidden rounded-3xl border border-white/12 shadow-editorial">
            <img
              src={featuredAuthor}
              alt="Sanman Thapa holding From the Window: The City of What Ifs at his signing table"
              loading="lazy"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>

          <div>
            <Eyebrow tone="light">Authors &amp; Publishers · Arti Facts Publishing</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight text-balance text-[oklch(0.97_0.006_90)] sm:text-4xl lg:text-[2.75rem]">
              Sanman Thapa's launch day
            </h2>
            <div className="rule-brand mt-5" />
            <p className="mt-6 text-base leading-relaxed text-[oklch(0.83_0.01_80)] sm:text-lg">
              Two titles brought to market and a live launch built around signed copies, a full room
              and a cover reveal film. From the Window: The City of What Ifs and A Fight for a Cup
              of Chai were carried from manuscript to shelf with Arti Facts Publishing and a launch
              delivered by HQ360.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { value: "2", label: "Titles in print" },
                { value: "1 day", label: "Live signing event" },
                { value: "Full", label: "Cover reveal film" },
              ].map((item) => (
                <li key={item.label} className="rounded-xl border border-white/12 px-5 py-4">
                  <span className="text-brand-gradient block font-display text-2xl font-semibold">
                    {item.value}
                  </span>
                  <span className="mt-1 block text-sm text-[oklch(0.8_0.01_80)]">{item.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/authors"
                className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground"
              >
                See the Authors system
              </Link>
              <Link
                to="/work/$slug"
                params={{ slug: "sanman-thapa-book-launch" }}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-[oklch(0.97_0.006_90)] hover:border-brand hover:text-brand"
              >
                Read the project
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
