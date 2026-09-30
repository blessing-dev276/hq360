import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import ceoPhoto from "@/assets/team-blessing.png";
import { CORE_SERVICES } from "@/data/agency";
import { Grain, Pill } from "./Hqd";

const WORDS = ["Websites", "Apps", "Systems", "Stories"];

export function HomeHero() {
  const photoRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function parallax(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || frame.current) return;
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
        <div className="hqd-hero-photo" ref={photoRef} aria-hidden="true">
          <img src={ceoPhoto} alt="" fetchPriority="high" decoding="async" />
        </div>
        <span className="hqd-hero-shade" aria-hidden="true" />
        <Grain />

        <div className="hqd-hero-inner">
          <div className="hqd-hero-main">
            <div>
              <p className="hqd-hero-kicker">Hey, we’re HQ360 —</p>
              <h1 id="hqd-hero-title" className="hqd-hero-title">
                <span className="sr-only">HQ360 builds websites, apps, systems and stories.</span>
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
              <div className="hqd-ceo-tag" style={{ marginTop: "1.75rem" }}>
                <img src={ceoPhoto} alt="" />
                <span>
                  Blessing Daniel
                  <small>Founder &amp; CEO, HQ360</small>
                </span>
              </div>
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
