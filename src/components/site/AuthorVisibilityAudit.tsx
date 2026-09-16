import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Search } from "lucide-react";
import { Container, Section, SectionHeader } from "@/components/site/Primitives";
import { AuditHero } from "@/components/site/AuditHero";
import { CTAS } from "@/config/brand";

const HERO_STEPS = [
  ["01", "Tell us about the author and book"],
  ["02", "HQ360 reviews the available public evidence"],
  ["03", "Receive a preliminary, evidence-backed assessment"],
] as const;

const HERO_CHIPS = ["Evidence-led", "Human reviewed", "No invented claims"];

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

export function AuthorVisibilityAudit() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
    try {
      const website = String(form.get("website") ?? "").trim();
      const amazonUrl = String(form.get("amazonUrl") ?? "").trim();
      const goodreadsUrl = String(form.get("goodreadsUrl") ?? "").trim();
      const response = await fetch("/api/public/author-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authorName: author,
          bookTitle: book,
          email,
          amazonUrlOrAsin: amazonUrl,
          websiteUrl: website,
          goodreadsUrl,
          consent: true,
          company_url: "",
        }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !result?.ok) throw new Error("request_failed");
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
        title="See what readers see before they decide to buy."
        lede="Get a preliminary view of how your book and author presence appear across the places readers use to discover, evaluate and purchase books."
        chips={HERO_CHIPS}
        steps={HERO_STEPS}
      />

      <Section id="audit-form">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div>
            <SectionHeader eyebrow="Start your audit" title="A clearer view of your visibility" />
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Links are optional, but they help HQ360 verify the right author and book. We do not
              infer private activity from what is not publicly visible.
            </p>
          </div>
          <form
            onSubmit={submit}
            className="rounded-2xl border border-border bg-secondary/35 p-5 sm:p-7"
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Author name <span className="text-brand">*</span>
                <input
                  className={inputClass}
                  name="author"
                  autoComplete="name"
                  placeholder="Your name"
                />
              </label>
              <label className="text-sm font-semibold">
                Book title <span className="text-brand">*</span>
                <input className={inputClass} name="book" placeholder="Title of your book" />
              </label>
              <label className="text-sm font-semibold">
                Amazon book URL <span className="font-normal text-muted-foreground">or ASIN</span>
                <input className={inputClass} name="amazonUrl" placeholder="https://amazon…" />
              </label>
              <label className="text-sm font-semibold">
                Author website
                <input className={inputClass} name="website" type="url" placeholder="https://…" />
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
                I consent to HQ360 reviewing the details and public links I provide to prepare a
                preliminary visibility assessment and to contact me about it.
              </span>
            </label>
            <input
              name="company_url"
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
          title="A complete reader-discovery picture"
          intro="The final audit is structured around the touchpoints a reader can actually encounter — not a generic score."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auditAreas.map((area) => (
            <li
              key={area}
              className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold"
            >
              <Search className="mb-5 size-5 text-brand" />
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
    </>
  );
}
