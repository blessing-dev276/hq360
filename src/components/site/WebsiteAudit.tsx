import { useState, type FormEvent } from "react";
import { ArrowRight, Gauge, LockKeyhole } from "lucide-react";
import { Container, Section, SectionHeader } from "@/components/site/Primitives";
import { AuditHero } from "@/components/site/AuditHero";
import { CTAS } from "@/config/brand";

type FormState = "idle" | "submitting" | "success" | "error";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20";

const HERO_STEPS = [
  ["01", "Tell us about the business and the site"],
  ["02", "HQ360 reviews the public evidence"],
  ["03", "Receive a preliminary, evidence-backed assessment"],
] as const;

const HERO_CHIPS = ["No fluff score", "Reviewed by a human", "One clear next step"];

const auditAreas = [
  "Site speed & mobile experience",
  "On-page SEO signals",
  "Conversion paths & forms",
  "Tracking & analytics setup",
  "Content & messaging clarity",
  "Technical health checks",
];

const reportRules = [
  "Every finding is tied to a source and retrieval date.",
  "What cannot be confirmed is marked “Unable to verify.”",
  "Internal notes and service mapping never appear in a public report.",
];

export function WebsiteAudit() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const website = String(form.get("website") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const consent = form.get("consent") === "on";

    if (!name || !website || !email || !consent) {
      setState("error");
      setMessage("Please add your name, website, email address and consent before continuing.");
      return;
    }

    setState("submitting");
    setMessage("");
    const industry = String(form.get("industry") ?? "").trim();
    const goal = String(form.get("goal") ?? "").trim();
    const honeypot = String(form.get("hp") ?? "");
    const payload = JSON.stringify({
      name,
      email,
      website,
      industry: industry || "Not specified",
      auditFocus: [goal ? `Main goal: ${goal}` : "", "Requested: Website Audit"]
        .filter(Boolean)
        .join("\n"),
      sourcePath: "/tools/website-audit",
      company_url: honeypot,
    });

    async function attempt() {
      const response = await fetch("/api/public/growth-audit", {
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
      event.currentTarget.reset();
    } catch {
      setState("error");
      setMessage("We could not submit your request. Please try again or contact HQ360 directly.");
    }
  }

  return (
    <>
      <AuditHero
        eyebrow="HQ360 proprietary tool"
        title="See your website the way a visitor actually does."
        lede="Get a preliminary view of how your website performs on speed, search, conversion paths and tracking — reviewed by a person, not an automated score."
        chips={HERO_CHIPS}
        steps={HERO_STEPS}
      />

      <Section id="audit-form">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div>
            <SectionHeader eyebrow="Start your audit" title="A clearer view of your website" />
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Tell us about the business and the site. We review what is publicly available and do
              not infer anything from private data.
            </p>
          </div>
          <form
            onSubmit={submit}
            className="rounded-2xl border border-border bg-secondary/35 p-5 sm:p-7"
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Your name <span className="text-brand">*</span>
                <input
                  className={inputClass}
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                />
              </label>
              <label className="text-sm font-semibold">
                Business name
                <input className={inputClass} name="business" placeholder="Your business" />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Website URL <span className="text-brand">*</span>
                <input className={inputClass} name="website" type="url" placeholder="https://…" />
              </label>
              <label className="text-sm font-semibold">
                Industry
                <input className={inputClass} name="industry" placeholder="e.g. Real estate" />
              </label>
              <label className="text-sm font-semibold">
                Main goal for the site
                <input className={inputClass} name="goal" placeholder="e.g. More booked calls" />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Email address <span className="text-brand">*</span>
                <input
                  className={inputClass}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
            </div>
            <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
              <input name="consent" type="checkbox" className="mt-1 size-4 accent-brand" />
              <span>
                I consent to HQ360 reviewing the details and public site I provide to prepare a
                preliminary website assessment and to contact me about it.
              </span>
            </label>
            {/* Honeypot — deliberately not named "company"/"url"/"website" etc,
                since those are exactly what autofill/password-manager
                extensions target even on a hidden field with
                autocomplete="off". */}
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
                className={`mt-5 rounded-xl p-4 text-sm ${state === "success" ? "bg-brand/10 text-foreground" : "bg-destructive/10 text-destructive"}`}
              >
                {message}
              </p>
            ) : null}
            <button
              disabled={state === "submitting"}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "submitting" ? "Sending request…" : "Request preliminary audit"}
              <ArrowRight className="size-4" />
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              A request is not an instant automated report. Findings are prepared only after
              research and review.
            </p>
          </form>
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeader
          eyebrow="What we examine"
          title="A complete picture, not a generic score"
          intro="The final audit is structured around what actually affects visitors and revenue — not a vanity number."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auditAreas.map((area) => (
            <li
              key={area}
              className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold"
            >
              <Gauge className="mb-5 size-5 text-brand" />
              {area}
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

      <section className="border-t border-border">
        <Container className="flex flex-col gap-5 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl">Want this built into a growth system?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore HQ360’s website and funnel services.
            </p>
          </div>
          <a
            href={CTAS.primary.to}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
          >
            Start a project <ArrowRight className="size-4" />
          </a>
        </Container>
      </section>
    </>
  );
}
