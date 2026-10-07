import { useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUpRight, Check, RotateCw, Sparkles } from "lucide-react";
import { Container } from "@/components/site/Primitives";
import {
  ECOMMERCE_AUDIT_AREAS,
  ECOMMERCE_FLYWHEEL,
  ECOMMERCE_PLATFORMS,
  ECOMMERCE_PRODUCT_PAGE,
  ECOMMERCE_STAGES,
  ECOMMERCE_SUBNICHES,
} from "@/data/ecommerce";
import "./ecommerce.css";

const num = (i: number) => String(i + 1).padStart(2, "0");

/** Roving-focus helper for the stage rail (mirrors IndustryPage's useTabs). */
function useRovingTabs(count: number) {
  const [active, setActive] = useState(0);
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? count - 1 : (index + step + count) % count;
    setActive(next);
    e.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }
  return { active, setActive, onKeyDown };
}

export function EcommerceSections() {
  return (
    <>
      <StageSystem />
      <ProductPageSystem />
      <Flywheel />
      <SubNiches />
      <StoreAudit />
    </>
  );
}

/* --------------------------------------------- seven connected stages */

function StageSystem() {
  const { active, setActive, onKeyDown } = useRovingTabs(ECOMMERCE_STAGES.length);
  const stage = ECOMMERCE_STAGES[active]!;
  return (
    <section className="ec-stages">
      <Container size="wide">
        <div className="ind-section-head">
          <p className="ind-eyebrow">
            <span /> The e-commerce growth system
          </p>
          <h2>Seven connected stages, from first click to repeat order.</h2>
          <p>
            Discover → visit → shop → purchase → recover → retain → purchase again → scale. Not
            seven services sitting beside each other — one system where each stage feeds the next.
          </p>
        </div>

        <div className="ec-stages-layout">
          <div
            className="ec-stage-rail"
            role="tablist"
            aria-label="E-commerce growth stages"
            aria-orientation="vertical"
            style={
              {
                "--progress": `${((active + 1) / ECOMMERCE_STAGES.length) * 100}%`,
              } as Record<string, string>
            }
          >
            {ECOMMERCE_STAGES.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                role="tab"
                id={`ec-stage-tab-${s.slug}`}
                aria-selected={i === active}
                aria-controls="ec-stage-panel"
                tabIndex={i === active ? 0 : -1}
                className={i === active ? "active" : ""}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              >
                <span className="ec-stage-num">{s.number}</span>
                <span className="ec-stage-verb">{s.verb}</span>
                <span className="ec-stage-cat">{s.category}</span>
              </button>
            ))}
          </div>

          <div
            id="ec-stage-panel"
            className="ec-stage-panel"
            role="tabpanel"
            aria-labelledby={`ec-stage-tab-${stage.slug}`}
            aria-live="polite"
          >
            <p className="ec-stage-panel-kicker">
              Stage {stage.number} / 07 · {stage.category}
            </p>
            <h3>{stage.headline}</h3>
            <p className="ec-stage-outcome">{stage.businessOutcome}</p>
            <div className="ec-stage-groups">
              {stage.serviceGroups.map((g) => (
                <div key={g.label}>
                  <p>{g.label}</p>
                  <ul>
                    {g.items.map((it) => (
                      <li key={it}>
                        <Check aria-hidden="true" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="ec-stage-flowto">
              <ArrowDown aria-hidden="true" /> {stage.flowTo}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------- product page system */

function ProductPageSystem() {
  return (
    <section className="ec-pp">
      <Container size="wide">
        <div className="ind-section-head light">
          <p className="ind-eyebrow">
            <span /> Inside stage 02
          </p>
          <h2>How HQ360 builds a product page.</h2>
          <p>
            A product page has a job: move a visitor from interest to a confident add-to-cart. We
            build it as a sequence — no manipulative dark patterns, no fabricated urgency, stock or
            reviews.
          </p>
        </div>
        <ol className="ec-pp-flow">
          {ECOMMERCE_PRODUCT_PAGE.map((s, i) => (
            <li key={s.step}>
              <span className="ec-pp-num">{num(i)}</span>
              <div>
                <h3>{s.step}</h3>
                <p>{s.note}</p>
              </div>
              {i < ECOMMERCE_PRODUCT_PAGE.length - 1 ? (
                <ArrowDown className="ec-pp-arrow" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------- 360 flywheel */

function Flywheel() {
  const [active, setActive] = useState(0);
  const phase = ECOMMERCE_FLYWHEEL[active]!;
  return (
    <section className="ec-fly">
      <Container size="wide">
        <div className="ind-section-head">
          <p className="ind-eyebrow">
            <span /> The HQ360 e-commerce growth flywheel
          </p>
          <h2>Every order should make the next one easier to win.</h2>
        </div>

        <div className="ec-fly-layout">
          <div
            className="ec-fly-wheel"
            style={{ "--count": String(ECOMMERCE_FLYWHEEL.length) } as Record<string, string>}
          >
            <div className="ec-fly-ring" aria-hidden="true" />
            <div className="ec-fly-core" aria-hidden="true">
              <Sparkles aria-hidden="true" />
              <strong>360°</strong>
              <span>always looping</span>
            </div>
            <ol className="ec-fly-nodes" role="tablist" aria-label="Growth flywheel phases">
              {ECOMMERCE_FLYWHEEL.map((p, i) => (
                <li key={p.phase} style={{ "--i": String(i) } as Record<string, string>}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    tabIndex={i === active ? 0 : -1}
                    className={i === active ? "active" : ""}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => setActive(i)}
                  >
                    <span className="ec-fly-node-num">{num(i)}</span>
                    <span className="ec-fly-node-phase">{p.phase}</span>
                    <span className="ec-fly-node-detail">{p.detail}</span>
                    {i === ECOMMERCE_FLYWHEEL.length - 1 ? (
                      <RotateCw className="ec-fly-loop" aria-hidden="true" />
                    ) : (
                      <ArrowDown className="ec-fly-step" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="ec-fly-detail" aria-live="polite">
            <p className="ec-fly-detail-kicker">
              Phase {num(active)} / {num(ECOMMERCE_FLYWHEEL.length - 1)}
            </p>
            <h3>{phase.phase}</h3>
            <p>{phase.detail}</p>
            <p className="ec-fly-detail-note">
              {active === ECOMMERCE_FLYWHEEL.length - 1
                ? "Optimise feeds straight back into Discover — the loop tightens each cycle."
                : `Hands off to ${ECOMMERCE_FLYWHEEL[active + 1]!.phase}.`}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- sub-niches */

function SubNiches() {
  return (
    <section className="ec-niche">
      <Container size="wide">
        <div className="ind-section-head light">
          <p className="ind-eyebrow">
            <span /> Built for product brands
          </p>
          <h2>The same system, tuned to how your category buys.</h2>
          <p>
            These are sub-niches of the E-commerce &amp; DTC vertical — not separate services.
            Health and wellness work stays within category advertising rules and makes no medical
            claims.
          </p>
        </div>
        <ul className="ec-niche-grid">
          {ECOMMERCE_SUBNICHES.map((n) => (
            <li key={n.name}>
              <h3>{n.name}</h3>
              <p>{n.outcome}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------- store growth audit */

function StoreAudit() {
  return (
    <section className="ec-audit">
      <Container size="wide">
        <div className="ec-audit-layout">
          <div>
            <p className="ind-eyebrow">
              <span /> Start with a Store Growth Audit
            </p>
            <h2>A manual HQ360 review of ten areas of your store.</h2>
            <p className="ec-audit-sub">
              Not an automated score — a person on the HQ360 team reviews your store and comes back
              with the one bottleneck costing the most right now, and where we&rsquo;d start. You do
              not need every stage of the growth system.
            </p>
            <a href="#start" className="ind-btn ind-btn-primary">
              Get my Store Growth Audit <ArrowUpRight aria-hidden="true" />
            </a>
            <p className="ec-audit-compliance">
              Advertising availability and campaign strategy depend on product category, platform
              policies and applicable regulations. HQ360 does not promise guaranteed ad approval,
              Shopping approval, rankings, revenue or ROAS.
            </p>
          </div>
          <div className="ec-audit-side">
            <ul className="ec-audit-list">
              {ECOMMERCE_AUDIT_AREAS.map((a, i) => (
                <li key={a}>
                  <span>{num(i)}</span>
                  {a}
                </li>
              ))}
            </ul>
            <div className="ec-audit-platforms">
              <p>Platforms we support</p>
              <ul>
                {ECOMMERCE_PLATFORMS.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong>
                    {p.note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
