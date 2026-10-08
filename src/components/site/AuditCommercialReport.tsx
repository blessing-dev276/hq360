import { useEffect, useRef, useState } from "react";
import {
  findingType,
  retrievalDates,
  type CommercialPlan,
  type MatchFinding,
  type ProposalDraft,
} from "@/lib/author-audit/commercial";
import { PHASES } from "@/lib/author-audit/services";
import { label } from "@/lib/author-audit/workflow";
export type Offer = CommercialPlan["services"][number];
const link = "text-sm text-[#ff8a3d] underline underline-offset-4";
export function EvidenceLinks({
  finding,
  onFinding,
}: {
  finding: MatchFinding;
  onFinding?: ((f: MatchFinding) => void) | undefined;
}) {
  return (
    <div className="mt-3 space-y-2 text-sm text-slate-400">
      {onFinding && (
        <button className={link} onClick={() => onFinding(finding)}>
          View finding: {finding.title} →
        </button>
      )}
      <p className="whitespace-pre-line">{finding.evidence}</p>
      <p>
        {label(finding.classification)} ·{" "}
        {retrievalDates(finding).length
          ? `Retrieved ${retrievalDates(finding).join(", ")}`
          : "Retrieval date not recorded"}
      </p>
      <div className="flex flex-wrap gap-3">
        {finding.source_urls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className={link}>
            {new URL(url).hostname} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
export function OfferDetails({
  service,
  findings,
  onFinding,
  onInquire,
}: {
  service: Offer;
  findings: MatchFinding[];
  onFinding?: ((f: MatchFinding) => void) | undefined;
  onInquire?: ((s: Offer) => void) | undefined;
}) {
  return (
    <article className="space-y-5 border-t border-white/15 py-7" id={`service-${service.id}`}>
      <div>
        <p className="text-xs text-[#ff8a3d]">{label(service.priority)} · Eligibility to confirm</p>
        <h3 className="mt-2 font-display text-2xl">{service.name}</h3>
      </div>
      <div>
        <h4 className="font-semibold">Why it fits</h4>
        {service.matches.map((m) => {
          const f = findings.find((f) => f.id === m.finding_id);
          return (
            f && (
              <div key={m.finding_id} className="mt-3">
                <p className="text-slate-300">{m.reason_for_match}</p>
                <EvidenceLinks finding={f} onFinding={onFinding} />
              </div>
            )
          );
        })}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="font-semibold">Proposed work</h4>
          <p className="mt-2 text-slate-300">{service.description}</p>
          <h4 className="mt-4 font-semibold">What you would receive</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
            {service.deliverables.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold">What is needed</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
            {service.prerequisites.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <h4 className="mt-4 font-semibold">What we would measure</h4>
          <p className="mt-2 text-slate-300">
            {service.primaryKpi}. Targets would follow a measured baseline.
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-400">
        {service.exclusions.join(". ")}. Scope and eligibility require confirmation.
      </p>
      <p className="text-sm">
        {service.pricing.quoteRequired
          ? "Tailored quote after scope confirmation"
          : `${service.pricing.currency} ${service.pricing.amount} — subject to agreed scope`}
      </p>
      <div className="flex flex-wrap gap-4">
        {onInquire && (
          <button
            className="rounded-full bg-[#ff5a00] px-5 py-3 font-semibold text-black"
            onClick={() => onInquire(service)}
          >
            Discuss {service.name} with HQ360
          </button>
        )}
        {service.landingUrl && (
          <a href={service.landingUrl} className={link}>
            Service details ↗
          </a>
        )}
      </div>
    </article>
  );
}
export function CommercialRoadmap({
  plan,
  findings,
  onFinding,
  onInquire,
}: {
  plan: CommercialPlan;
  findings: MatchFinding[];
  onFinding: (f: MatchFinding) => void;
  onInquire?: ((s: Offer) => void) | undefined;
}) {
  return (
    <div className="mt-8 space-y-10">
      <p className="text-slate-300">
        Confirm the author objective, rights, purchase paths and measurement baseline before paid
        promotion. Sequence follows dependencies; dates and effort will be agreed after scope
        confirmation.
      </p>
      {findings.some(
        (f) => f.recommendation && !plan.matches.some((m) => m.finding_id === f.id),
      ) && (
        <section>
          <h2 className="font-display text-2xl">Author-led next steps</h2>
          <ul className="mt-4 space-y-4">
            {findings
              .filter((f) => f.recommendation && !plan.matches.some((m) => m.finding_id === f.id))
              .map((f) => (
                <li key={f.id}>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-slate-300">{f.recommendation}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {label(f.classification)} · No paid service proposed for this finding.
                  </p>
                  <button className={link} onClick={() => onFinding(f)}>
                    Review evidence and limitations →
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
      {PHASES.map((phase) => {
        const services = plan.services.filter((s) => s.phase === phase);
        return (
          services.length > 0 && (
            <section key={phase}>
              <h2 className="font-display text-2xl">{phase}</h2>
              <ol className="mt-5 space-y-5">
                {services.map((s) => (
                  <li key={s.id} className="border-l border-[#ff5a00]/50 pl-5">
                    <h3 className="font-semibold">
                      {s.name} · {label(s.priority)}
                    </h3>
                    <p className="mt-2 text-slate-300">HQ360: {s.description}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Author preparation: {s.prerequisites.join("; ")}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">Success indicator: {s.primaryKpi}</p>
                    {s.beforePromotion && (
                      <p className="mt-2 text-sm text-[#ff8a3d]">
                        Complete this foundation before related paid promotion.
                      </p>
                    )}
                    {s.matches.map((m) => {
                      const f = findings.find((f) => f.id === m.finding_id);
                      return (
                        f && (
                          <button
                            key={m.finding_id}
                            className={`${link} mt-2 block text-left`}
                            onClick={() => onFinding(f)}
                          >
                            Evidence: {f.title} →
                          </button>
                        )
                      );
                    })}
                    {onInquire && (
                      <button className={`${link} mt-3`} onClick={() => onInquire(s)}>
                        Discuss scope and next steps →
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )
        );
      })}
    </div>
  );
}
export function CommercialSummary({
  findings,
  plan,
  go,
}: {
  findings: MatchFinding[];
  plan: CommercialPlan | null;
  go: (page: string) => void;
}) {
  const strengths = findings.filter(
    (f) =>
      findingType(f) === "strength" &&
      ["verified_fact", "direct_observation"].includes(f.classification),
  );
  return (
    <section className="mt-10 space-y-6 border-t border-white/10 pt-8">
      {strengths.length > 0 && (
        <div>
          <h2 className="font-display text-2xl">Strengths to build on</h2>
          <ul className="mt-3 space-y-2">
            {strengths.map((f) => (
              <li key={f.id}>
                <button
                  className="text-left text-emerald-200 underline underline-offset-4"
                  onClick={() => go(f.category)}
                >
                  {f.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan && (
        <>
          <div>
            <h2 className="font-display text-2xl">Your objective</h2>
            <p className="mt-3 text-slate-300">
              {plan.objective ||
                "Confirm the readership or commercial objective with the author before choosing a campaign."}
            </p>
          </div>
          {plan.services.length > 0 && (
            <div>
              <h2 className="font-display text-2xl">Recommended approach</h2>
              <p className="mt-3 text-slate-300">
                Start with{" "}
                {plan.services
                  .slice(0, 3)
                  .map((s) => s.name)
                  .join(", ")}
                , subject to eligibility and scope confirmation.
              </p>
              <p className="mt-3 text-slate-300">
                Initial deliverables:{" "}
                {plan.services
                  .slice(0, 3)
                  .map((s) => s.deliverables[0])
                  .join("; ")}
                .
              </p>
              <button className={`${link} mt-4`} onClick={() => go("hq360_opportunities")}>
                Review the evidence and discuss a tailored plan →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
export function InquiryDialog({
  service,
  author,
  onClose,
}: {
  service: Offer;
  author: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      className="max-h-[90vh] w-[min(94vw,36rem)] overflow-y-auto rounded-2xl border border-white/20 bg-[#111] p-6 text-white backdrop:bg-black/70"
      aria-labelledby="inquiry-title"
    >
      <h2 id="inquiry-title" className="font-display text-2xl">
        Discuss {service.name}
      </h2>
      {sent ? (
        <p role="status" className="mt-5">
          Your inquiry has been saved for HQ360. We will use your email to respond.
        </p>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const r = await fetch("/api/private-audit/commerce", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: form.get("name"),
                  email: form.get("email"),
                  message: form.get("message"),
                  consent: form.get("consent") === "on",
                  serviceId: service.id,
                  findingIds: service.matches.map((m) => m.finding_id),
                }),
              });
              const body = await r.json();
              if (!r.ok || !body.ok) throw new Error(body.error || "Could not save your inquiry.");
              setSent(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-slate-300">
            HQ360 will receive your selected service and supporting finding references. This is an
            inquiry, not a purchase.
          </p>
          <label className="block">
            Name
            <input
              name="name"
              defaultValue={author}
              required
              maxLength={160}
              autoComplete="name"
              className="mt-1 w-full rounded border border-white/25 bg-black p-2"
            />
          </label>
          <label className="block">
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              className="mt-1 w-full rounded border border-white/25 bg-black p-2"
            />
          </label>
          <label className="block">
            What would you like to discuss?
            <textarea
              name="message"
              maxLength={3000}
              rows={4}
              className="mt-1 w-full rounded border border-white/25 bg-black p-2"
            />
          </label>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="consent" required />I agree that HQ360 may use these
            details to respond to this inquiry. No newsletter subscription is added.
          </label>
          <a href="/privacy" className={link}>
            Privacy policy
          </a>
          {error && (
            <p role="alert" className="text-red-300">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="block rounded-full bg-[#ff5a00] px-5 py-3 font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Send inquiry"}
          </button>
        </form>
      )}
      <button type="button" className="mt-5 text-sm underline" onClick={onClose}>
        Close
      </button>
    </dialog>
  );
}
export function ClientProposal({ proposal }: { proposal: ProposalDraft }) {
  return (
    <section className="mt-10 space-y-5 border-t border-white/20 pt-8">
      <h2 className="font-display text-3xl">{proposal.title}</h2>
      <p className="text-sm text-[#ff8a3d]">Approved HQ360 proposal · for discussion</p>
      {(
        [
          ["Objective", proposal.objective],
          ["Scope", proposal.scope],
          ["Timeline", proposal.timeline || "To be agreed"],
          ["Terms", proposal.terms],
          ["Exclusions", proposal.exclusions],
        ] as const
      ).map(([title, text]) => (
        <div key={title}>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-2 whitespace-pre-line text-slate-300">{text}</p>
        </div>
      ))}
      {(
        [
          ["Deliverables", proposal.deliverables],
          ["Dependencies", proposal.dependencies],
          ["Success indicators", proposal.successIndicators],
        ] as const
      ).map(([title, values]) => (
        <div key={title}>
          <h3 className="font-semibold">{title}</h3>
          <ul className="mt-2 list-disc pl-5 text-slate-300">
            {values.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      ))}
      <p>
        {proposal.pricing.quoteRequired
          ? "Pricing: tailored quote required"
          : `Pricing: ${proposal.pricing.currency} ${proposal.pricing.amount}`}
      </p>
    </section>
  );
}
