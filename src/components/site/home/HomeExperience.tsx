import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Mail, MessageCircle } from "lucide-react";
import { AGENCY_PROCESS, AUDIENCES, CORE_SERVICES } from "@/data/agency";
import { BRAND } from "@/config/brand";
import { useExpertDirectory } from "@/lib/experts";
import { Reveal } from "../Reveal";
import { TestimonialStrip } from "../TestimonialStrip";
import { ProjectInquiryForm } from "../ProjectInquiryForm";
import { Eyebrow, Grain, Num, PersonCard, Pill, spotlight } from "../hqd/Hqd";
import { HomeHero } from "../hqd/HomeHero";
import { WorkArc } from "../hqd/WorkArc";
import { Packages } from "../hqd/Packages";
import { ServiceCards } from "../hqd/ServiceCards";

const BAND_WORDS = ["Websites", "Mobile Apps", "Automation", "CRM", "Writing", "Translation"];


export function HomeExperience() {
  const directory = useExpertDirectory();

  return (
    <div className="hqd dark">
      <HomeHero />

      <div className="hqd-marquee" aria-hidden="true">
        {(["orange", "outline"] as const).map((tone) => (
          <div key={tone} className={`hqd-band hqd-band--${tone}`}>
            {[0, 1].map((copy) => (
              <div key={copy}>
                {BAND_WORDS.map((word) => (
                  <span key={word}>
                    {word} <i>✺</i>
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <section className="hqd-section">
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Who we are</Eyebrow>
              <h2 className="hqd-h2">
                Design with purpose.
                <br />
                <span className="hqd-orange-text">Build with intent.</span>
              </h2>
            </div>
            <div className="hqd-split-aside hqd-about-copy">
              <p className="hqd-lede">
                One connected team for the website, the systems behind it and the words on it.
              </p>
              <p className="hqd-body">{BRAND.positioning}</p>
              <p className="hqd-body">
                We start with what you need to get done, agree the scope in writing, and share the
                work at every milestone — so nothing about the project is a surprise.
              </p>
            </div>
          </Reveal>
          <Reveal className="hqd-stats" delay={120}>
            {[
              [String(CORE_SERVICES.length), "Core services under one roof"],
              [String(AUDIENCES.length), "Audiences we build for"],
              [String(directory.team.length), "Specialists on the core team"],
              ["1", "Named lead on every project"],
            ].map(([value, label]) => (
              <div key={label} className="hqd-stat">
                <strong className="hqd-orange-text">{value}</strong>
                <span>{label}</span>
              </div>
            ))}
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
                From strategy to shipped product — the right skills for the job, not a bundle you
                don’t need.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
                <p className="hqd-body" style={{ maxWidth: "16rem" }}>
                  Pick one service or combine them. We’ll tell you honestly what fits.
                </p>
                <Pill to="/services" tone="orange">
                  All services
                </Pill>
              </div>
            </div>
          </Reveal>
          <ServiceCards />
        </div>
      </section>

      <section className="hqd-section" style={{ paddingTop: 0 }}>
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Who we help</Eyebrow>
              <h2 className="hqd-h2">
                Different businesses.
                <br />
                Specific needs.
              </h2>
            </div>
            <p className="hqd-split-aside hqd-body">
              Find the starting point that fits the way you work — each page shows what we build for
              that audience and how a project runs.
            </p>
          </Reveal>
          <nav aria-label="Audiences" className="hqd-rows">
            {AUDIENCES.map((audience, index) => (
              <Link
                key={audience.slug}
                to={`/${audience.slug}` as string}
                preload="intent"
                className="hqd-row"
              >
                <Num n={index + 1} />
                <span className="hqd-row-name">{audience.name}</span>
                <span className="hqd-row-summary">{audience.summary}</span>
                <ArrowUpRight className="hqd-row-arrow" size={30} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section id="work" className="hqd-section" style={{ paddingTop: 0, scrollMarginTop: "5rem" }}>
        <div className="hqd-wrap">
          <Reveal className="hqd-arc-head">
            <Eyebrow>Behind the work</Eyebrow>
            <h2 className="hqd-h2">
              Curious what else
              <br />
              we’ve created?
            </h2>
            <p className="hqd-body">
              Websites, author launches, covers, films and campaigns. Drag the reel, or open the
              full collection.
            </p>
            <Pill to="/work">See more projects</Pill>
          </Reveal>
        </div>
        <WorkArc />
        <div className="hqd-wrap">
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

      <section className="hqd-section" style={{ paddingTop: 0 }}>
        <div className="hqd-wrap">
          <Packages ctaHref="#project-inquiry" />
        </div>
      </section>

      <section className="hqd-section" style={{ paddingTop: 0 }}>
        <div className="hqd-wrap">
          <Reveal className="hqd-split">
            <div>
              <Eyebrow>Our experts</Eyebrow>
              <h2 className="hqd-h2">
                The people
                <br />
                behind the work
              </h2>
            </div>
            <div className="hqd-split-aside">
              <p className="hqd-body">
                Meet the HQ360 team and the independent experts who work alongside us. Tap a card to
                see what each person does.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <Pill to="/experts" tone="orange">
                  Meet all experts
                </Pill>
                <Pill to="/expert-signup" tone="ghost">
                  Become an Expert
                </Pill>
              </div>
            </div>
          </Reveal>
          <div className="hqd-people">
            {directory.all.slice(0, 4).map((person, index) => (
              <Reveal key={person.slug} delay={index * 80}>
                <PersonCard person={person} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <TestimonialStrip title="Feedback from our clients" />

      <section
        id="project-inquiry"
        className="hqd-section"
        style={{ scrollMarginTop: "4rem", paddingBottom: "clamp(3rem, 6vw, 5rem)" }}
      >
        <div className="hqd-cta">
          <Grain />
          <div className="hqd-wrap" style={{ paddingInline: 0 }}>
            <Eyebrow>Start a project</Eyebrow>
            <h2 className="hqd-cta-title" style={{ marginTop: "1rem" }}>
              Let’s build
              <br />
              <span className="hqd-orange-text">what’s next.</span>
            </h2>
            <div className="hqd-cta-grid">
              <div>
                <p className="hqd-lede">Tell us what you’d like to build or improve.</p>
                <p className="hqd-body" style={{ marginTop: "1rem" }}>
                  Choose your business type and the services you need. A short starting brief is
                  enough — we’ll reply with next steps.
                </p>
                <div className="hqd-contact-list">
                  <a href={`mailto:${BRAND.email}`}>
                    <Mail size={18} aria-hidden="true" /> {BRAND.email}
                  </a>
                  <a href={BRAND.whatsappHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={18} aria-hidden="true" /> WhatsApp {BRAND.whatsapp}
                  </a>
                </div>
              </div>
              <div className="hqd-form-shell hqd-form-shell--bare">
                <ProjectInquiryForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
