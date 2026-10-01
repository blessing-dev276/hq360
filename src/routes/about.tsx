import { createFileRoute } from "@tanstack/react-router";
import teamGroup1 from "@/assets/team-group-hero.jpg";
import teamGroup2 from "@/assets/team-group-2.jpg";
import teamGroup3 from "@/assets/team-group-3.jpg";
import teamGroup4 from "@/assets/team-group-4.jpg";
import { AGENCY_PROCESS } from "@/data/agency";
import { BRAND } from "@/config/brand";
import { useExpertDirectory } from "@/lib/experts";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";
import { Reveal } from "@/components/site/Reveal";
import { CtaBand } from "@/components/site/CtaBand";
import { Eyebrow, Grain, Num, PersonCard, Pill } from "@/components/site/hqd/Hqd";
import { ServiceCards } from "@/components/site/hqd/ServiceCards";

export const Route = createFileRoute("/about")({
  head: () =>
    buildSeo(
      {
        title: "About HQ360 | Digital Services & Content",
        description:
          "Meet the HQ360 team working on websites, apps, automation and written content.",
        path: "/about",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ]),
    ),
  component: AboutPage,
});

const TEAM_GROUP_PHOTOS = [teamGroup1, teamGroup2, teamGroup3, teamGroup4];

function AboutPage() {
  const { team } = useExpertDirectory();

  return (
    <>
      <section className="hqd-page-hero">
        <div className="hqd-page-panel">
          <span className="hqd-hero-glow" aria-hidden="true" />
          <div className="hqd-page-photo hqd-page-photo--wide" aria-hidden="true">
            {TEAM_GROUP_PHOTOS.map((src, index) => (
              <img
                key={src}
                src={src}
                alt=""
                decoding="async"
                {...(index === 0
                  ? { fetchPriority: "high" as const }
                  : { loading: "lazy" as const })}
              />
            ))}
          </div>
          <span className="hqd-hero-shade" aria-hidden="true" />
          <Grain />
          <div className="hqd-page-inner">
            <div>
              <p className="hqd-hero-kicker">Websites · Apps · Systems · Content</p>
              <h1 className="hqd-page-title">About</h1>
            </div>
            <div className="hqd-hero-aside">
              <p className="hqd-lede">The team behind the work.</p>
              <p>
                Founded by Blessing Daniel, HQ360 is one connected team for your website, the
                systems behind it and the words on it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="hqd-section">
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Who we are</Eyebrow>
              <h2 className="hqd-h2">
                Built with purpose.
                <br />
                <span className="hqd-orange-text">Delivered as one team.</span>
              </h2>
            </div>
            <div className="hqd-split-aside">
              <p className="hqd-lede">
                Shaping websites, systems and stories through strategy, craft and collaboration.
              </p>
              <p className="hqd-body">{BRAND.positioning}</p>
              <p className="hqd-body">
                We work with businesses, creators, authors and other agencies. Formerly{" "}
                {BRAND.formerlyKnownAs}, we bring the required work into an agreed scope, with clear
                review points and handover.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="hqd-section" style={{ paddingTop: 0 }}>
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Services</Eyebrow>
              <h2 className="hqd-h2">
                What we can
                <br />
                help you with
              </h2>
            </div>
            <div className="hqd-split-aside">
              <p className="hqd-lede">
                From strategy to visuals to code — tailored services that help your brand grow with
                clarity.
              </p>
              <Pill to="/contact" tone="orange">
                Get in Touch
              </Pill>
            </div>
          </Reveal>
          <ServiceCards />
        </div>
      </section>

      <section id="team" className="hqd-section" style={{ paddingTop: 0, scrollMarginTop: "5rem" }}>
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Our team</Eyebrow>
              <h2 className="hqd-h2">
                The people
                <br />
                behind HQ360
              </h2>
            </div>
            <div className="hqd-split-aside">
              <p className="hqd-body">
                Meet a few of the people who shape and deliver HQ360 projects.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <Pill to="/experts" tone="orange">
                  Meet the full team
                </Pill>
                <Pill to="/expert-signup" tone="ghost">
                  Become an Expert
                </Pill>
              </div>
            </div>
          </Reveal>
          <div className="hqd-people">
            {team.slice(0, 3).map((person, index) => (
              <Reveal key={person.slug} delay={(index % 4) * 70}>
                <PersonCard person={person} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="hqd-section" style={{ paddingTop: 0 }}>
        <div className="hqd-wrap">
          <Reveal className="hqd-arc-head">
            <Eyebrow>How we work</Eyebrow>
            <h2 className="hqd-h2">
              Clear steps, from hello
              <br />
              to handover
            </h2>
          </Reveal>
          <ol className="hqd-steps">
            {AGENCY_PROCESS.map(([title, body], index) => (
              <li key={title} className="hqd-step">
                <Num n={index + 1} />
                <strong>{title}</strong>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand
        title="Ready to build what’s next?"
        body="Tell us what you need, and we’ll agree the scope and next steps."
      />
    </>
  );
}
