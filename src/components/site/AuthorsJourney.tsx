import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import type { Industry } from "@/data/industries";
import {
  AUTHOR_ASSETS,
  AUTHOR_GOALS,
  AUTHOR_STAGES,
  WHERE_NOW_OPTIONS,
  type AuthorStageId,
  type ServiceAudience,
} from "@/data/authors-journey";
import { Container } from "@/components/site/Primitives";
import { FaqSection } from "@/components/site/FaqSection";
import { ProjectInquiryForm } from "@/components/site/ProjectInquiryForm";
import { useReveal } from "@/hooks/use-reveal";
import "./authors-journey.css";

const STAGE_COUNT = AUTHOR_STAGES.length;

/** Roving-focus tab group: hover / focus / click / arrow keys all select. */
function useRoving(count: number, initial = 0) {
  const [active, setActive] = useState(initial);
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

function AjSection({
  id,
  className,
  children,
}: {
  id?: string;
  className: string;
  children: ReactNode;
}) {
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section
      id={id}
      ref={ref}
      className={`aj-reveal ${className}`}
      data-inview={visible || undefined}
    >
      {children}
    </section>
  );
}

function scrollToStage(id: AuthorStageId) {
  document.getElementById(`aj-stage-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ===================================================================== */

export function AuthorsJourney({ industry, proof }: { industry: Industry; proof?: ReactNode }) {
  const [journeyStage, setJourneyStage] = useState<AuthorStageId>("idea");

  return (
    <div className="aj">
      <Hero
        onFindStage={() =>
          document.getElementById("aj-where")?.scrollIntoView({ behavior: "smooth" })
        }
      />
      <WhereAreYouNow
        onSelect={(stage) => {
          setJourneyStage(stage);
          scrollToStage(stage);
        }}
      />
      <Journey active={journeyStage} onActive={setJourneyStage} />
      {proof}
      <GrowthPlan />
      <FinalCta industry={industry} />
    </div>
  );
}

/* --------------------------------------------------------------- 1 · hero */

function Hero({ onFindStage }: { onFindStage: () => void }) {
  const [hovered, setHovered] = useState<AuthorStageId | null>(null);
  const shown = AUTHOR_STAGES.find((s) => s.id === hovered) ?? AUTHOR_STAGES[0]!;

  return (
    <section className="aj-hero">
      <Container size="wide">
        <div className="aj-hero-layout">
          <div className="aj-hero-copy">
            <p className="aj-eyebrow">
              <span /> Authors &amp; Publishers
            </p>
            <h1>
              From book idea to <em>scalable author business.</em>
            </h1>
            <p className="aj-hero-lede">
              Whether you&rsquo;re still developing the idea, preparing the manuscript, getting
              ready to publish, launching, or scaling an existing catalogue — HQ360 connects the
              strategy, publishing support, brand, distribution, marketing and reader systems around
              your book.
            </p>
            <div className="aj-actions">
              <a href="#client-stories" className="aj-btn aj-btn-primary">
                Client stories <ArrowDown aria-hidden="true" />
              </a>
              <button type="button" onClick={onFindStage} className="aj-btn aj-btn-ghost">
                Find my starting point <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="aj-orbit-wrap">
            <div className="aj-orbit" role="group" aria-label="The eight-stage author journey">
              <div className="aj-orbit-ring" aria-hidden="true" />
              <div className="aj-orbit-core">
                <strong>HQ360</strong>
                <span>Your book</span>
              </div>
              {AUTHOR_STAGES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`aj-orbit-node node-${i + 1}`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(s.id)}
                  onFocus={() => setHovered(s.id)}
                  onPointerLeave={() => setHovered(null)}
                  onBlur={() => setHovered(null)}
                  onClick={() => scrollToStage(s.id)}
                >
                  <em>{s.number}</em>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="aj-orbit-caption" aria-live="polite">
              <strong>{shown.label}</strong> — {shown.orbitLine}
            </p>
          </div>
        </div>

        <a href="#aj-where" className="aj-scroll-cue">
          <ArrowDown aria-hidden="true" /> Find where you are in the journey
        </a>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- 2 · where now */

function WhereAreYouNow({ onSelect }: { onSelect: (stage: AuthorStageId) => void }) {
  const { active, setActive, onKeyDown } = useRoving(WHERE_NOW_OPTIONS.length);
  const option = WHERE_NOW_OPTIONS[active]!;

  return (
    <AjSection id="aj-where" className="aj-where">
      <Container size="wide">
        <div className="aj-head">
          <p className="aj-eyebrow">
            <span /> Where are you now?
          </p>
          <h2>Choose the stage that feels closest to where you are today.</h2>
        </div>

        <div className="aj-where-layout">
          <div className="aj-where-rail" role="tablist" aria-label="Your current stage">
            {WHERE_NOW_OPTIONS.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                className={i === active ? "active" : ""}
                onKeyDown={(e) => onKeyDown(e, i)}
                onClick={() => setActive(i)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="aj-where-panel" aria-live="polite">
            <p className="aj-where-kicker">Your starting point</p>
            <h3>{option.label}</h3>
            <ol className="aj-where-path">
              {option.path.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button
              type="button"
              className="aj-btn aj-btn-dark"
              onClick={() => onSelect(option.stage)}
            >
              Start from here <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </Container>
    </AjSection>
  );
}

/* -------------------------------------------------- 3+4 · the journey */

function Journey({
  active,
  onActive,
}: {
  active: AuthorStageId;
  onActive: (id: AuthorStageId) => void;
}) {
  const index = AUTHOR_STAGES.findIndex((s) => s.id === active);
  const stage = AUTHOR_STAGES[index]!;
  const [audience, setAudience] = useState<"all" | ServiceAudience>("all");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const matchesAudience = (a?: ServiceAudience) =>
    audience === "all" || !a || a === "both" || a === audience;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? STAGE_COUNT - 1
          : (i + step + STAGE_COUNT) % STAGE_COUNT;
    onActive(AUTHOR_STAGES[next]!.id);
    e.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }

  return (
    <AjSection id="aj-journey" className="aj-journey">
      <Container size="wide">
        <div className="aj-head">
          <p className="aj-eyebrow">
            <span /> The complete author journey
          </p>
          <h2>
            Your book doesn&rsquo;t start at publishing — and growth doesn&rsquo;t stop at the first
            sale.
          </h2>
        </div>

        {/* Chapter rail — the sticky progress indicator */}
        <ol className="aj-chapters" role="tablist" aria-label="Author journey stages">
          {AUTHOR_STAGES.map((s, i) => (
            <li key={s.id} data-state={i < index ? "done" : i === index ? "active" : "next"}>
              <button
                type="button"
                role="tab"
                id={`aj-stage-${s.id}`}
                aria-selected={s.id === active}
                tabIndex={s.id === active ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, i)}
                onClick={() => onActive(s.id)}
              >
                <em>{i < index ? <Check aria-hidden="true" /> : s.number}</em>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <div className="aj-chapters-track" aria-hidden="true">
          <span style={{ width: `${(index / (STAGE_COUNT - 1)) * 100}%` }} />
        </div>

        {/* Active chapter */}
        <div className="aj-chapter" aria-live="polite">
          <p className="aj-chapter-kicker">
            Chapter {stage.number} <span>/ {String(STAGE_COUNT).padStart(2, "0")}</span>
          </p>
          <h3>{stage.headline}</h3>
          <p className="aj-chapter-body">{stage.body}</p>

          <div className="aj-audience-filter" role="group" aria-label="Filter services by category">
            {(["all", "fiction", "nonfiction"] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={a === audience ? "active" : ""}
                aria-pressed={a === audience}
                onClick={() => setAudience(a)}
              >
                {a === "all" ? "All" : a === "fiction" ? "Fiction" : "Nonfiction"}
              </button>
            ))}
          </div>

          <div className="aj-chapter-groups">
            {stage.serviceGroups.map((g) => {
              const items = g.items.filter((it) => matchesAudience(it.audience));
              if (items.length === 0) return null;
              return (
                <div key={g.name}>
                  <p className="aj-group-name">{g.name}</p>
                  <ul>
                    {items.map((item) => {
                      const key = `${stage.id}-${g.name}-${item.name}`;
                      const open = openItem === key;
                      return (
                        <li key={item.name}>
                          <button
                            type="button"
                            className="aj-service-toggle"
                            aria-expanded={open}
                            onClick={() => setOpenItem(open ? null : key)}
                          >
                            <span>{item.name}</span>
                            {item.audience && item.audience !== "both" ? (
                              <em className="aj-service-tag">{item.audience}</em>
                            ) : null}
                          </button>
                          {open ? <p className="aj-service-blurb">{item.blurb}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="aj-chapter-outcome">
            <span>Outcome</span>
            {stage.outcome}
          </p>

          <p className="aj-chapter-transition">{stage.transition}</p>
        </div>
      </Container>
    </AjSection>
  );
}

/* --------------------------------------------------------- growth plan */

function GrowthPlan() {
  const [goalId, setGoalId] = useState<string | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const goal = useMemo(() => AUTHOR_GOALS.find((g) => g.id === goalId), [goalId]);

  function toggleAsset(a: string) {
    setAssets((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  }

  return (
    <AjSection className="aj-plan">
      <Container size="wide">
        <div className="aj-head light">
          <p className="aj-eyebrow">
            <span /> Your author growth plan
          </p>
          <h2>Where do you want your book to go next?</h2>
        </div>

        <div className="aj-plan-layout">
          <div>
            <p className="aj-plan-q">What is your main goal?</p>
            <div className="aj-plan-options">
              {AUTHOR_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={g.id === goalId ? "active" : ""}
                  aria-pressed={g.id === goalId}
                  onClick={() => setGoalId(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <p className="aj-plan-q">What do you already have? (optional)</p>
            <div className="aj-plan-options">
              {AUTHOR_ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={assets.includes(a) ? "active" : ""}
                  aria-pressed={assets.includes(a)}
                  onClick={() => toggleAsset(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="aj-plan-result" aria-live="polite">
            {goal ? (
              <>
                <p className="aj-plan-kicker">Recommended for you</p>
                <h3>{goal.recommended}</h3>
                <ul className="aj-plan-stack">
                  {goal.stack.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="aj-plan-note">
                  This is a starting point, not every service you need. HQ360 confirms the exact
                  plan once we know your book.
                </p>
                <a href="#start" className="aj-btn aj-btn-primary">
                  Build my author growth plan <ArrowUpRight aria-hidden="true" />
                </a>
              </>
            ) : (
              <p className="aj-plan-placeholder">
                Choose a goal to see the HQ360 path we&rsquo;d recommend.
              </p>
            )}
          </div>
        </div>
      </Container>
    </AjSection>
  );
}

/* --------------------------------------------------------------- final */

function FinalCta({ industry }: { industry: Industry }) {
  return (
    <AjSection id="start" className="aj-final">
      <Container size="wide">
        <div className="aj-final-top">
          <p className="aj-eyebrow light">
            <span /> Start here
          </p>
          <h2>Your book deserves more than a publish button.</h2>
          <p className="aj-final-lede">
            Whether you&rsquo;re still shaping the idea or already selling, HQ360 can help build the
            system that moves the book forward.
          </p>
        </div>

        <div className="aj-final-layout">
          <div>
            <ul className="aj-final-points">
              <li>We reply within one working day</li>
              <li>You own every account and asset we build</li>
              <li>No guaranteed sales, rankings or bestseller claims — a straight plan instead</li>
            </ul>
            {industry.faqs.length > 0 ? (
              <div className="aj-final-faq">
                <p className="aj-final-faq-title">Questions authors ask</p>
                <FaqSection faqs={industry.faqs} idPrefix={`aj-${industry.slug}`} />
              </div>
            ) : null}
          </div>
          <ProjectInquiryForm
            defaultIndustry={industry.shortName}
            sourceIndustry={industry.shortName}
          />
        </div>
      </Container>
    </AjSection>
  );
}
