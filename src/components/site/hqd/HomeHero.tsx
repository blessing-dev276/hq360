import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import team1 from "@/assets/team-hero-1-cutout.webp";
import team2 from "@/assets/team-hero-2-cutout.webp";
import team3 from "@/assets/team-hero-3-cutout.webp";
import team4 from "@/assets/team-hero-4-cutout.webp";
import team5 from "@/assets/team-hero-5-cutout.webp";
import { CORE_SERVICES } from "@/data/agency";
import { Grain, Pill } from "./Hqd";

// Each word shows with one portrait; both loops share the same timing in hqd.css.
const WORDS = ["Websites", "Apps", "Systems", "Stories", "Brands"];
const TEAM = [team1, team2, team3, team4, team5];

export function HomeHero() {
  const photoRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function parallax(event: React.PointerEvent<HTMLDivElement>) {
    if (
      event.pointerType !== "mouse" ||
      frame.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const { clientX, clientY, currentTarget } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rect = currentTarget.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      photoRef.current?.style.setProperty("--px", `${(-x * 26).toFixed(1)}px`);
      photoRef.current?.style.setProperty("--py", `${(-y * 18).toFixed(1)}px`);
    });
  }

  return (
    <section className="hqd-hero" aria-labelledby="hqd-hero-title">
      <div className="hqd-hero-panel" onPointerMove={parallax}>
        <span className="hqd-hero-glow" aria-hidden="true" />
        <div className="hqd-hero-photo hqd-hero-team" ref={photoRef} aria-hidden="true">
          {TEAM.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              decoding="async"
              {...(index === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
            />
          ))}
        </div>
        <span className="hqd-hero-shade" aria-hidden="true" />
        <Grain />

        <div className="hqd-hero-inner">
          <div className="hqd-hero-main">
            <div>
              <p className="hqd-hero-kicker">Hey, we’re HQ360 —</p>
              <h1 id="hqd-hero-title" className="hqd-hero-title">
                <span className="sr-only">
                  HQ360 builds websites, apps, systems, stories and brands.
                </span>
                <span aria-hidden="true">
                  <span className="hqd-line">
                    <span>We Build</span>
                  </span>
                  <span className="hqd-line">
                    <span className="hqd-rotator">
                      {WORDS.map((word) => (
                        <span key={word}>
                          {word}
                          <span className="hqd-dot">.</span>
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              </h1>
              <Link to="/experts" className="hqd-team-strip" aria-label="Meet the HQ360 team">
                <span className="hqd-team-faces" aria-hidden="true">
                  {TEAM.map((src) => (
                    <img key={src} src={src} alt="" loading="lazy" />
                  ))}
                </span>
                <span>
                  The HQ360 team
                  <small>One connected team, every angle</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="hqd-hero-aside">
              <p className="hqd-lede">Great work should feel effortless.</p>
              <p>
                From the first idea to launch day, HQ360 builds the websites, apps, systems and
                words that help people find you, trust you and get in touch.
              </p>
              <div className="hqd-hero-actions">
                <Pill href="#project-inquiry">Start a Project</Pill>
                <Pill to="/expert-signup" tone="ghost">
                  Become an Expert
                </Pill>
              </div>
            </div>
          </div>

          <nav aria-label="Core services" className="hqd-hero-services">
            {CORE_SERVICES.map((service, index) => (
              <Link
                key={service.slug}
                to="/services/$slug"
                params={{ slug: service.slug }}
                preload="intent"
              >
                <b>
                  <em>#</em>
                  {String(index + 1).padStart(2, "0")}
                </b>
                {service.name}
              </Link>
            ))}
          </nav>
        </div>

        <a href="#work" className="hqd-badge" aria-label="See our work">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <path id="hqd-circle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
            </defs>
            <text fontSize="9.4" fontWeight="600" letterSpacing="2.6" fill="currentColor">
              <textPath href="#hqd-circle">BUILT FOR WHAT’S NEXT • HQ360 SPACE •</textPath>
            </text>
          </svg>
          <span>
            <ArrowUpRight size={22} strokeWidth={2.4} />
          </span>
        </a>
      </div>
    </section>
  );
}
