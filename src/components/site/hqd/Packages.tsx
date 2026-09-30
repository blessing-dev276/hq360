import { Check } from "lucide-react";
import { CARE_PLAN, PLANS, PRICING_NOTES } from "@/data/pricing";
import { Reveal } from "../Reveal";
import { Eyebrow, Pill } from "./Hqd";

export function Packages({
  heading = true,
  ctaHref = "/contact",
}: {
  heading?: boolean;
  ctaHref?: string;
}) {
  return (
    <>
      {heading && (
        <Reveal className="hqd-plans-head">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="hqd-h2">
            Simple packages
            <br />
            for every stage
          </h2>
          <p className="hqd-body" style={{ maxWidth: "34rem" }}>
            Honest starting prices with a written scope before any work begins — no surprises.
          </p>
        </Reveal>
      )}
      <div className="hqd-plans">
        {PLANS.map((plan, index) => (
          <Reveal key={plan.name} delay={index * 90}>
            <article
              className={`hqd-plan ${plan.featured ? "hqd-plan--hot" : ""}`}
              style={{ height: "100%" }}
            >
              <div className="hqd-plan-top">
                <p className="hqd-plan-name">
                  {plan.name}
                  {plan.tag && <span className="hqd-plan-tag">{plan.tag}</span>}
                </p>
                <p className="hqd-plan-price">
                  {plan.price} <small>/{plan.cadence}</small>
                </p>
                <p className="hqd-plan-note">{plan.note}</p>
              </div>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}>
                    <Check size={16} strokeWidth={3} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <Pill
                {...(ctaHref.startsWith("#") ? { href: ctaHref } : { to: ctaHref })}
                tone={plan.featured ? "light" : "dark"}
              >
                Get Started
              </Pill>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="hqd-plan-foot">
        <p>
          <strong>
            Care plans from {CARE_PLAN.price}
            {CARE_PLAN.cadence}
          </strong>{" "}
          — updates, backups and small changes after launch.
        </p>
        {PRICING_NOTES.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </>
  );
}
