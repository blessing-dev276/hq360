import { useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Compass,
  LockKeyhole,
  Ruler,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { Container, Section, SectionHeader } from "@/components/site/Primitives";
import "./author-audit-page.css";

const HERO_STEPS = [
  ["01", "Tell us about the author and book"],
  ["02", "HQ360 reviews the available public evidence"],
  ["03", "Receive a preliminary, evidence-backed assessment"],
] as const;

type FormState = "idle" | "submitting" | "success" | "error";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20";

const auditAreas = [
  "Book & retailer presence",
  "Author identity & profile",
  "Search visibility",
  "Website & reader journey",
  "Goodreads, social & authority signals",
  "Marketing infrastructure",
];

const reportRules = [
  "Every finding is tied to a source and retrieval date.",
  "What cannot be confirmed is marked “Unable to verify.”",
  "Internal notes and service mapping never appear in a public report.",
];

const SMART_PILLARS = [
  {
    letter: "S",
    label: "Specific",
    icon: Target,
    body: "Every finding becomes a scoped fix tied to your book and platform — never a vague recommendation.",
  },
  {
    letter: "M",
    label: "Measurable",
    icon: Ruler,
    body: "Each phase ships against something checkable: tracking fixed, page live, listing corrected, journey tested.",
  },
  {
    letter: "A",
    label: "Achievable",
    icon: Compass,
    body: "Work is phased and sized to your timeline — foundational fixes first, so nothing stalls waiting on the rest.",
  },
  {
    letter: "R",
    label: "Relevant",
    icon: TrendingUp,
    body: "Every task maps directly back to a finding from your audit. Nothing generic, nothing you didn’t ask for.",
  },
  {
    letter: "T",
    label: "Time-bound",
    icon: CalendarClock,
    body: "A written delivery date for every phase, agreed with you before any work starts.",
  },
] as const;

const IMPLEMENTATION_STEPS = [
  ["01", "Audit", "Your preliminary visibility assessment identifies what to fix and why."],
  ["02", "Plan", "Findings become a SMART-structured scope: specific tasks, phased and dated."],
  ["03", "Build", "HQ360 implements the plan and reports progress against the agreed targets."],
] as const;

export function AuthorVisibilityAudit() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function nextStep() {
    const fields = formRef.current?.querySelectorAll<HTMLInputElement>(
      `[data-step="${step}"] input`,
    );
    for (const field of fields ?? []) {
      if (!field.reportValidity()) return;
    }
    setMessage("");
    setStep((current) => Math.min(2, current + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      nextStep();
      return;
    }
    const formElement = event.currentTarget;
    if (!formElement.reportValidity()) return;
    const form = new FormData(formElement);
    const author = String(form.get("author") ?? "").trim();
    const book = String(form.get("book") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const consent = form.get("consent") === "on";

    if (!author || !book || !email || !consent) {
      setState("error");
      setMessage("Please add your name, book title, email address and consent before continuing.");
      return;
    }

    setState("submitting");
    setMessage("");
    const website = String(form.get("website") ?? "").trim();
    const amazonUrl = String(form.get("amazonUrl") ?? "").trim();
    const goodreadsUrl = String(form.get("goodreadsUrl") ?? "").trim();
    const honeypot = String(form.get("hp") ?? "");
    const payload = JSON.stringify({
      authorName: author,
      bookTitle: book,
      email,
      amazonUrlOrAsin: amazonUrl,
      websiteUrl: website,
      goodreadsUrl,
      consent: true,
      company_url: honeypot,
    });

    async function attempt() {
      const response = await fetch("/api/public/author-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !result?.ok) throw new Error("request_failed");
    }

    try {
      try {
        await attempt();
      } catch (err) {
        // A dropped connection (common on mobile networks) throws a network
        // error before any response arrives — the request may already have
        // reached the server. One retry, safe because the server dedupes
        // identical submissions a few minutes apart.
        if (err instanceof TypeError) {
          await new Promise((r) => setTimeout(r, 800));
          await attempt();
        } else {
          throw err;
        }
      }
      setState("success");
      setMessage(
        "Your preliminary audit request is with HQ360. We will review the supplied information before any research is presented as a finding.",
      );
      formElement.reset();
    } catch {
      setState("error");
      setMessage("We could not submit your request. Please try again or contact HQ360 directly.");
    }
  }

  return (
    <div className="author-audit-page">
      <section className="author-audit-hero">
        <Container className="author-audit-hero-grid">
          <div>
            <span className="author-audit-eyebrow">Complimentary author visibility audit</span>
            <h1>
              A great book deserves
              <br />
              <em>to be discovered.</em>
            </h1>
            <p>
              See how readers find your book, what earns their trust, and where the journey could be
              stronger. Get a preliminary assessment reviewed by the HQ360 team.
            </p>
            <a href="#audit-form" className="author-audit-cta">
              Start my audit <ArrowRight size={18} />
            </a>
            <span className="author-audit-note">
              Free to request · Human reviewed · No account needed
            </span>
          </div>
          <aside className="author-audit-preview">
            <span className="author-audit-eyebrow">Inside your assessment</span>
            <BookOpen size={34} className="my-6" />
            <h2>
              Your reader’s journey.
              <br />A clearer next chapter.
            </h2>
            <div className="author-audit-preview-row">
              <span>01 / Discovery</span>
              <p>Can the right readers find you?</p>
            </div>
            <div className="author-audit-preview-row">
              <span>02 / Trust</span>
              <p>Does your online presence build confidence?</p>
            </div>
            <div className="author-audit-preview-row">
              <span>03 / Action</span>
              <p>Is the next step clear and easy?</p>
            </div>
            <small>Illustrative overview — your findings depend on available evidence.</small>
          </aside>
        </Container>
      </section>

      <Section id="audit-form">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div>
            <SectionHeader eyebrow="Start your audit" title="A clearer view of your visibility" />
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Links are optional, but they help HQ360 verify the right author and book. We do not
              infer private activity from what is not publicly visible.
            </p>
            <ol className="author-audit-process">
              {HERO_STEPS.map(([number, text]) => (
                <li key={number}>
                  <span>{number}</span>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
          {state === "success" ? (
            <div className="author-audit-success" role="status">
              <CheckCircle2 size={44} />
              <h2>Your next chapter starts here.</h2>
              <p>{message}</p>
              <p>
                The team will use your email address to follow up. You don’t need to submit again.
              </p>
              <a href="/authors" className="author-audit-cta">
                Explore author services <ArrowRight size={17} />
              </a>
            </div>
          ) : (
            <form
              ref={formRef}
              onSubmit={submit}
              className="rounded-2xl border border-border bg-secondary/35 p-5 sm:p-7"
              noValidate
            >
              <div className="author-audit-stepper" aria-label="Request progress">
                {["Your book", "Your links", "Your details"].map((label, index) => (
                  <span
                    key={label}
                    aria-current={step === index ? "step" : undefined}
                    data-complete={step > index}
                  >
                    <b>{step > index ? "✓" : index + 1}</b>
                    {label}
                  </span>
                ))}
              </div>
              <h3 className="mb-2 font-display text-xl">
                {["Let’s meet your book.", "Connect the dots.", "Where can we reach you?"][step]}
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                {
                  [
                    "Tell us who you are and which book you’d like us to review.",
                    "These links are optional. Add what you have, or continue to the next step.",
                    "We’ll use this email to follow up on your assessment.",
                  ][step]
                }
              </p>
              <fieldset data-step="0" hidden={step !== 0}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Author name <span className="text-brand">*</span>
                    <input
                      className={inputClass}
                      name="author"
                      required
                      maxLength={160}
                      autoComplete="name"
                      placeholder="Your name"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Book title <span className="text-brand">*</span>
                    <input
                      className={inputClass}
                      name="book"
                      required
                      maxLength={300}
                      placeholder="Title of your book"
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset data-step="1" hidden={step !== 1}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Amazon book URL{" "}
                    <span className="font-normal text-muted-foreground">or ASIN</span>
                    <input className={inputClass} name="amazonUrl" placeholder="https://amazon…" />
                  </label>
                  <label className="text-sm font-semibold">
                    Author website
                    <input
                      className={inputClass}
                      name="website"
                      type="url"
                      placeholder="https://…"
                    />
                  </label>
                  <label className="text-sm font-semibold sm:col-span-2">
                    Goodreads book or author URL
                    <input
                      className={inputClass}
                      name="goodreadsUrl"
                      type="url"
                      placeholder="https://goodreads.com/…"
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset data-step="2" hidden={step !== 2}>
                <div className="grid gap-5">
                  <label className="text-sm font-semibold sm:col-span-2">
                    Email address <span className="text-brand">*</span>
                    <input
                      className={inputClass}
                      name="email"
                      required
                      maxLength={320}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </label>
                </div>
                <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                  <input
                    name="consent"
                    type="checkbox"
                    required
                    className="mt-1 size-4 accent-brand"
                  />
                  <span>
                    I consent to HQ360 reviewing the details and public links I provide to prepare a
                    preliminary visibility assessment and to contact me about it.
                  </span>
                </label>
              </fieldset>
              {/* Honeypot — deliberately not named "company"/"url"/"website" etc,
                since those are exactly what autofill/password-manager
                extensions target even on a hidden field with
                autocomplete="off", which previously produced a false
                validation failure for real visitors. */}
              <input
                name="hp"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              {message ? (
                <p
                  role="status"
                  className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
                >
                  {message}
                </p>
              ) : null}
              <div className="mt-6 flex items-center gap-3">
                {step > 0 ? (
                  <button
                    type="button"
                    disabled={state === "submitting"}
                    className="rounded-full border border-border px-5 py-3 text-sm"
                    onClick={() => {
                      setStep(step - 1);
                      setMessage("");
                    }}
                  >
                    Back
                  </button>
                ) : null}
                <button
                  disabled={state === "submitting"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state === "submitting"
                    ? "Sending request…"
                    : step < 2
                      ? "Continue"
                      : "Request my free audit"}
                  <ArrowRight className="size-4" />
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                A request is not an instant automated report. Findings are prepared only after
                research and review.
              </p>
            </form>
          )}
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeader
          eyebrow="What we examine"
          title="A complete reader-discovery picture"
          intro="The final audit is structured around the touchpoints a reader can actually encounter — not a generic score."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auditAreas.map((area) => (
            <li
              key={area}
              className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold"
            >
              <details>
                <summary className="cursor-pointer">
                  <Search className="mb-5 size-5 text-brand" />
                  {area}
                  <span className="mt-3 block text-xs font-normal text-muted-foreground">
                    Explore this area +
                  </span>
                </summary>
                <p className="mt-4 text-sm font-normal leading-relaxed text-muted-foreground">
                  {
                    [
                      "How your book is presented on retailer pages, including the details that help readers decide.",
                      "Whether readers can recognise the same author across public profiles and book pages.",
                      "What readers can discover when searching for your name and book.",
                      "How easily a visitor can move from learning about you to exploring or buying your book.",
                      "Public reviews, profiles and mentions that help readers evaluate your work.",
                      "Visible opportunities to connect with readers and support an ongoing relationship.",
                    ][auditAreas.indexOf(area)]
                  }
                </p>
              </details>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="carbon">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHeader
            tone="light"
            eyebrow="Methodology"
            title="Useful, without pretending certainty"
            intro="A polished report is only valuable if its statements can be trusted."
          />
          <ul className="space-y-4">
            {reportRules.map((rule) => (
              <li
                key={rule}
                className="flex gap-3 rounded-xl border border-white/15 p-4 text-sm leading-relaxed text-white/80"
              >
                <LockKeyhole className="mt-0.5 size-4 shrink-0 text-brand" />
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="After your audit"
          title="SMART HQ360 Implementation Services"
          intro="Findings only matter once they become fixes. HQ360's implementation service turns your audit into a scoped, SMART-structured plan — Specific, Measurable, Achievable, Relevant and Time-bound."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SMART_PILLARS.map((pillar) => (
            <li
              key={pillar.letter}
              className="flex flex-col rounded-2xl border border-border bg-card p-5"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-soft font-display text-lg text-[oklch(0.42_0.16_42)]">
                {pillar.letter}
              </span>
              <pillar.icon className="mt-4 size-4 text-brand" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">{pillar.label}</p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                {pillar.body}
              </p>
            </li>
          ))}
        </ul>

        <ol className="mt-12 grid gap-6 rounded-2xl border border-border bg-secondary/35 p-6 sm:grid-cols-3 sm:p-8">
          {IMPLEMENTATION_STEPS.map(([number, title, body]) => (
            <li key={number}>
              <span className="font-display text-xl text-brand">{number}</span>
              <p className="mt-2 font-display text-base">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="font-display text-xl">Ready to move from audit to action?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Once your preliminary audit is reviewed, HQ360 can scope the SMART implementation plan
              alongside it.
            </p>
          </div>
          <a
            href="/contact"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5"
          >
            Start my implementation plan <ArrowRight className="size-4" />
          </a>
        </div>
      </Section>

      <section className="border-t border-border">
        <Container className="flex flex-col gap-5 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl">Need help with your author platform now?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore HQ360’s author and publisher growth services.
            </p>
          </div>
          <a
            href="/authors"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
          >
            Explore author services <ArrowRight className="size-4" />
          </a>
        </Container>
      </section>
    </div>
  );
}
