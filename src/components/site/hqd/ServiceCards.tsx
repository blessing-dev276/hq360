import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";
import { CORE_SERVICES } from "@/data/agency";
import { Reveal } from "../Reveal";
import { Grain, Num, spotlight } from "./Hqd";

/** Numbered service cards plus the "Become an Expert" card (homepage, About). */
export function ServiceCards() {
  return (
    <div className="hqd-cards">
      {CORE_SERVICES.map((service, index) => (
        <Reveal key={service.slug} delay={index * 70}>
          <Link
            to="/services/$slug"
            params={{ slug: service.slug }}
            preload="intent"
            className="hqd-card"
            onPointerMove={spotlight}
          >
            <span className="hqd-card-rule" aria-hidden="true" />
            <span className="hqd-card-top">
              <Num n={index + 1} />
              <span className="hqd-card-arrow" aria-hidden="true">
                <ArrowUpRight size={18} strokeWidth={2.4} />
              </span>
            </span>
            <span className="hqd-card-body">
              <h3>{service.name}</h3>
              <p>{service.description}</p>
            </span>
            <ul className="hqd-ticks">
              {service.deliverables.slice(0, 3).map((item) => (
                <li key={item}>
                  <Check size={15} strokeWidth={3} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Link>
        </Reveal>
      ))}
      <Reveal delay={CORE_SERVICES.length * 70}>
        <Link
          to="/expert-signup"
          preload="intent"
          className="hqd-card hqd-card--join"
          onPointerMove={spotlight}
        >
          <Grain />
          <span className="hqd-card-top">
            <span className="hqd-num" style={{ color: "#fff" }}>
              Join us
            </span>
            <span className="hqd-card-arrow" aria-hidden="true">
              <ArrowUpRight size={18} strokeWidth={2.4} />
            </span>
          </span>
          <span className="hqd-card-body">
            <h3 style={{ fontSize: "clamp(2.2rem, 3.4vw, 3rem)" }}>Become an Expert</h3>
            <p>
              Writers, designers, developers and marketers — apply to work alongside HQ360 and
              get a public expert profile.
            </p>
          </span>
        </Link>
      </Reveal>
    </div>
  );
}
