import { MarketingHero } from "@/components/site/MarketingHero";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { buildSeo } from "@/lib/seo";
import { useExpertDirectory } from "@/lib/experts";
import { Reveal } from "@/components/site/Reveal";
import { Eyebrow, Grain, PersonCard } from "@/components/site/hqd/Hqd";

export const Route = createFileRoute("/experts/")({
  head: () =>
    buildSeo({
      title: "Our Experts | HQ360",
      description:
        "Meet the HQ360 team and the independent experts who build websites, apps, systems and content with us.",
      path: "/experts",
    }),
  component: ExpertsPage,
});

function ExpertsPage() {
  const { team, experts, loading } = useExpertDirectory();

  return (
    <div className="hqd dark">
      <MarketingHero
        eyebrow="The people behind HQ360"
        title={
          <>
            Great work starts with
            <br />
            <em>the right people.</em>
          </>
        }
        description="A connected core team, plus independent writers, designers, developers and marketers approved to work alongside us."
        primary={{ label: "Meet our experts", href: "#experts" }}
        secondary={{ label: "Become an expert", href: "/expert-signup" }}
      />

      <section id="experts" className="hqd-section">
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Core team</Eyebrow>
              <h2 className="hqd-h2">HQ360 team</h2>
            </div>
            <p className="hqd-split-aside hqd-body">
              The people who lead HQ360 projects day to day. Tap a card to see their profile.
            </p>
          </Reveal>
          <div className="hqd-people">
            {team.map((person, index) => (
              <Reveal key={person.slug} delay={index * 70}>
                <PersonCard person={person} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="hqd-section" style={{ paddingTop: 0 }}>
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Independent experts</Eyebrow>
              <h2 className="hqd-h2">Expert network</h2>
            </div>
            <p className="hqd-split-aside hqd-body">
              Approved specialists who publish a public profile. Every expert is reviewed by HQ360
              before they appear here.
            </p>
          </Reveal>
          <div className="hqd-people">
            {experts.map((person, index) => (
              <Reveal key={person.slug} delay={index * 70}>
                <PersonCard person={person} />
              </Reveal>
            ))}
            {!loading && (
              <Reveal delay={experts.length * 70}>
                <a
                  href="/expert-signup"
                  className="hqd-card hqd-card--join"
                  style={{ height: "100%", minHeight: "22rem" }}
                >
                  <Grain />
                  <span className="hqd-card-body" style={{ paddingTop: "1rem" }}>
                    <span className="hqd-num" style={{ color: "#fff" }}>
                      {experts.length ? "Join them" : "Be the first"}
                    </span>
                    <h3>Become an Expert</h3>
                    <p>Apply in two minutes. Once approved, you’ll get a profile page here.</p>
                  </span>
                  <span
                    className="hqd-pill"
                    style={{ alignSelf: "flex-start", margin: "0 0.6rem" }}
                  >
                    <span>Apply now</span>
                    <span className="hqd-pill-dot" aria-hidden="true">
                      <ArrowUpRight size={17} strokeWidth={2.4} />
                    </span>
                  </span>
                </a>
              </Reveal>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
