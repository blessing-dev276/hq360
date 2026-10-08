import { z } from "zod";
import {
  configuredServices,
  DEFAULT_COMMERCIAL_CONFIG,
  PHASES,
  SIGNALS,
  pricingSchema,
  type CommercialConfig,
  type Signal,
} from "./services";

const prose = z
  .string()
  .trim()
  .max(6000)
  .regex(/^(?![\s\S]*<\/?[a-z][^>]*>)[\s\S]*$/i, "Use plain text");
export const evidenceSignalSchema = z
  .object({
    kind: z.enum(SIGNALS),
    source_url: z.string().url(),
    excerpt: prose.min(1),
  })
  .strict();
export const findingCommercialSchema = z
  .object({
    finding_type: z.enum(["problem", "opportunity", "strength", "unknown"]),
    reader_impact: prose.default(""),
    business_impact: prose.default(""),
    retrieval_dates: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .max(30)
      .default([]),
    evidence_limitations: prose.default(""),
    signals: z.array(evidenceSignalSchema).max(21).default([]),
    proposed_next_action: prose.default(""),
    metrics: z
      .array(
        z
          .object({
            label: prose.min(1).max(100),
            value: z.number().nullable(),
            evidence: prose,
            source_url: z.string().url().nullable(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
  })
  .strict();
export type FindingCommercial = z.infer<typeof findingCommercialSchema>;
export type MatchFinding = {
  id: string;
  category: string;
  title: string;
  classification: string;
  what_we_found: string;
  evidence: string;
  source_urls: string[];
  why_it_matters?: string;
  recommendation: string;
  implementation_steps?: string[];
  priority: string;
  confidence_score?: number | null;
  commercial?: FindingCommercial | null | undefined;
  review_status?: string;
  hidden?: boolean;
};
const normalized = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
export const prohibitedClaim =
  /\b(?:guarantee[ds]?\s+(?:(?:a|your|the|\d+)\s+)?(?:sales|rankings?|bestseller|revenue|placement|votes)|guaranteed\s+(?:sales|rankings?|bestseller|revenue|placement|votes)|our\s+(?:publisher|publishing)\s+(?:partners?|connections?)|will\s+(?:double|triple)\s+(?:your\s+)?(?:sales|revenue))\b/i;
export function unsafeClaims(text: string) {
  const withoutLimitations = text.replace(
    /\b(?:no|never|not|cannot|do not|don't)\s+(?:guarantee[ds]?|promise[ds]?)\s+[^.!?\n]*/gi,
    "",
  );
  return prohibitedClaim.test(withoutLimitations);
}
const signalConditions: Record<Signal, RegExp> = {
  relevant_goodreads_list: /list|goodreads/i,
  category_mismatch:
    /(?:category|keyword|search term)[^.]{0,100}(?:mismatch|incorrect|unrelated|misalign)|(?:mismatch|incorrect|unrelated|misalign)[^.]{0,100}(?:category|keyword|search term)/i,
  listing_content_gap:
    /(?:description|listing|edition|purchase link)[^.]{0,100}(?:missing|incomplete|broken|incorrect|inconsistent)|(?:missing|incomplete|broken|incorrect|inconsistent)[^.]{0,100}(?:description|listing|edition|purchase link)/i,
  author_page_gap:
    /(?:author page|author central)[^.]{0,80}(?:missing|incomplete|incorrect)|(?:missing|incomplete|incorrect)[^.]{0,80}(?:author page|author central)/i,
  enhanced_content_gap:
    /(?:A\+|enhanced content)[^.]{0,80}(?:missing|not visible|absent)|(?:missing|not visible|absent)[^.]{0,80}(?:A\+|enhanced content)/i,
  launch_plan: /release|launch|publication plan/i,
  consented_audience: /consent|opt.in|permission.based/i,
  media_asset: /award|prize|winner|interview|expertise|professional/i,
  distribution_gap:
    /(?:unavailable|out of stock|not available|cannot (?:buy|purchase)|territorial restriction)/i,
  audio_demand:
    /(?:audio|listening)[^.]{0,100}(?:demand|interest|requests)|(?:demand|interest|requests)[^.]{0,100}(?:audio|listening)/i,
  video_objective: /video|trailer|youtube/i,
  website_journey_gap:
    /(?:broken|missing|unclear|difficult)[^.]{0,80}(?:link|navigation|purchase|reading order)|(?:link|navigation|purchase|reading order)[^.]{0,80}(?:broken|missing|unclear|difficult)/i,
  backlist_decline:
    /(?:sales|readership|performance)[^.]{0,100}(?:declin|decreas|fell|drop)|(?:declin|decreas|fell|drop)[^.]{0,100}(?:sales|readership|performance)/i,
  positioning_uncertainty: /genre|positioning|comparable|audience fit/i,
  signup_gap: /newsletter|signup|sign.up|opt.in/i,
  goodreads_engagement: /goodreads|reader review|ratings/i,
  media_kit_gap: /media kit|press kit|award|prize|interview/i,
  visual_audience: /pinterest|visual audience|visual discovery/i,
  advance_review_plan: /advance|review cop|ARC|NetGalley/i,
  discussion_potential: /discussion|themes|reader|book club|perspectives/i,
  local_campaign: /local audience|geographic|billboard|outdoor campaign/i,
};
export function signalSupported(kind: Signal, evidence: string) {
  if (!signalConditions[kind].test(evidence)) return false;
  if (
    ["media_asset", "media_kit_gap"].includes(kind) &&
    /\b(?:no|unverified|not verified|unconfirmed|author.reported)\b[^.]{0,50}(?:award|prize|expertise)|(?:award|prize)[^.]{0,50}\b(?:not verified|unconfirmed)\b/i.test(
      evidence,
    )
  )
    return false;
  if (
    ["distribution_gap", "backlist_decline", "category_mismatch"].includes(kind) &&
    /not established|unverified|unclear|unknown|could not verify/i.test(evidence)
  )
    return false;
  if (
    kind === "backlist_decline" &&
    (!/publication|published/i.test(evidence) || (evidence.match(/\b\d{4}\b/g) ?? []).length < 2)
  )
    return false;
  return true;
}
export function integrityIssues(f: Omit<MatchFinding, "id"> | MatchFinding): string[] {
  const errors: string[] = [];
  const c = f.commercial;
  if (
    unsafeClaims(
      [f.what_we_found, f.recommendation, f.why_it_matters, c?.business_impact, c?.reader_impact]
        .filter(Boolean)
        .join("\n"),
    )
  )
    errors.push("Unsupported commercial guarantee or publisher relationship");
  if (
    ["verified_fact", "direct_observation"].includes(f.classification) &&
    (!(f.source_urls ?? []).length || !f.evidence?.trim())
  )
    errors.push("Factual observations require evidence and source URLs");
  if (
    c?.finding_type === "problem" &&
    !["verified_fact", "direct_observation"].includes(f.classification)
  )
    errors.push("Uncertain observations must be opportunities or unknown, not verified problems");
  if (c && f.classification === "unknown" && c.finding_type !== "unknown")
    errors.push("Unknown evidence must remain unknown");
  const evidence = normalized(f.evidence);
  for (const s of c?.signals ?? []) {
    if (!signalSupported(s.kind, s.excerpt))
      errors.push(`Signal ${s.kind} lacks evidence of the required condition`);
    if (!f.source_urls.includes(s.source_url) || !evidence.includes(normalized(s.excerpt)))
      errors.push(`Signal ${s.kind} must quote the finding's cited evidence`);
  }
  for (const m of c?.metrics ?? []) {
    if (
      m.value !== null &&
      (!m.source_url ||
        !f.source_urls.includes(m.source_url) ||
        !evidence.includes(normalized(m.evidence)) ||
        !m.evidence.replaceAll(",", "").includes(String(m.value)))
    )
      errors.push(`Metric ${m.label} requires its value in cited evidence`);
  }
  // Quantified sales/conversion claims cannot be inferred from a rank or review count.
  for (const match of [f.what_we_found, c?.reader_impact ?? "", c?.business_impact ?? ""]
    .join(" ")
    .matchAll(/(?:[$£€]\s*\d[\d,.]*|\d[\d,.]*\s*%|\d[\d,.]*\s+(?:sales|copies|readers))/gi)) {
    if (!evidence.includes(normalized(match[0])))
      errors.push("Numerical commercial metrics need a quoted evidence baseline");
  }
  if (
    /\b(?:absent from all|no (?:goodreads )?lists anywhere|no newsletter exists)\b/i.test(
      f.what_we_found,
    )
  )
    errors.push("Search absence cannot establish universal absence");
  return [...new Set(errors)];
}
// Conservative adapters for existing saved audits. These inspect observations and
// evidence, never legacy service labels or AI sales copy. No facts are rewritten.
export function findingSignals(
  f: MatchFinding,
): { kind: Signal; source_url: string; excerpt: string }[] {
  if (!f.source_urls.length || !f.evidence || f.classification === "unknown") return [];
  const text = `${f.title} ${f.what_we_found} ${f.evidence}`;
  const kinds: Signal[] = [];
  if (f.category === "media_and_authority" && signalSupported("media_asset", f.evidence))
    kinds.push("media_asset", "media_kit_gap");
  if (
    ["website_audit", "email_newsletter_audit"].includes(f.category) &&
    /(?:no|not|without|missing)[^.]{0,65}(?:newsletter|signup|sign.up)|(?:newsletter|signup|sign.up)[^.]{0,65}(?:not visible|missing|not found)/i.test(
      text,
    )
  )
    kinds.push("signup_gap");
  if (
    f.category === "goodreads_audit" &&
    /goodreads/i.test(f.evidence) &&
    /ratings|reviews|author page/i.test(f.evidence)
  )
    kinds.push("goodreads_engagement");
  if (
    f.category === "goodreads_listopia_audit" &&
    f.source_urls.some((u) => /goodreads\.com\/list\//.test(u)) &&
    /\brelevant\b|strong fit/i.test(f.title) &&
    !/weaker|not relevant|poor fit/i.test(f.title)
  )
    kinds.push("relevant_goodreads_list");
  if (
    f.category === "reader_and_community_opportunities" &&
    /readers|reviews|themes|perspectives|discussion/i.test(text)
  )
    kinds.push("discussion_potential");
  const explicit = (f.commercial?.signals ?? []).filter((s) => signalSupported(s.kind, s.excerpt));
  return [
    ...explicit,
    ...kinds
      .filter((kind) => signalSupported(kind, f.evidence))
      .filter((kind) => !explicit.some((s) => s.kind === kind))
      .map((kind) => ({ kind, source_url: f.source_urls[0]!, excerpt: f.evidence })),
  ];
}
export function findingType(f: MatchFinding): FindingCommercial["finding_type"] {
  if (f.classification === "unknown") return "unknown";
  if (f.commercial) return f.commercial.finding_type;
  if (
    /media_and_authority|what_the_author_already_has/.test(f.category) &&
    /winner|win|award|prize|recognition|interview/i.test(f.evidence)
  )
    return "strength";
  if (/already carries|multi-retailer reach|distinctive.*format/i.test(f.title)) return "strength";
  return "opportunity";
}
export function retrievalDates(f: MatchFinding) {
  return [
    ...new Set([
      ...(f.commercial?.retrieval_dates ?? []),
      ...Array.from((f.evidence ?? "").matchAll(/\b\d{4}-\d{2}-\d{2}\b/g), (m) => m[0]),
    ]),
  ];
}
const rank: Record<string, number> = {
  immediate: 0,
  high_impact: 1,
  medium_priority: 2,
  long_term: 3,
  optional: 4,
};
export function matchServices(findings: MatchFinding[], config = DEFAULT_COMMERCIAL_CONFIG) {
  return findings.flatMap((f) => {
    if (
      f.hidden ||
      (f.review_status && f.review_status !== "approved") ||
      f.classification === "unknown" ||
      integrityIssues(f).length ||
      !f.source_urls.length ||
      !f.evidence
    )
      return [];
    const signals = findingSignals(f);
    return configuredServices(config)
      .filter((s) => s.enabled)
      .flatMap((service) => {
        const support = signals.filter((signal) => service.signals.includes(signal.kind));
        if (!support.length) return [];
        // Strong commercial/rights claims must be directly observed, not guesses.
        if (
          [
            "distribution",
            "amazon-keywords-categories",
            "amazon-listing",
            "author-central",
            "amazon-a-plus",
            "backlist-revival",
          ].includes(service.id) &&
          !["verified_fact", "direct_observation"].includes(f.classification)
        )
          return [];
        if (service.id === "backlist-revival" && !/\b\d{4}\b/.test(f.evidence)) return [];
        const tentative = !["verified_fact", "direct_observation"].includes(f.classification);
        return [
          {
            service_id: service.id,
            finding_id: f.id,
            fit_score: tentative ? 60 : 85,
            eligibility_status: "needs_confirmation" as const,
            supporting_evidence_ids: [...new Set(support.map((s) => s.source_url))],
            reason_for_match: `${f.title}: ${tentative ? "a potential opportunity, subject to confirmation" : "a cited observation"}. ${service.description}`,
            proposed_scope: service.description,
            expected_deliverable: service.deliverables.join("; "),
            measurable_success_indicator: service.primaryKpi,
            limitations: [
              ...service.exclusions,
              ...(f.commercial?.evidence_limitations ? [f.commercial.evidence_limitations] : []),
              "Scope and eligibility require confirmation; results are not guaranteed.",
            ],
            priority: f.priority,
            confidence: f.confidence_score ?? null,
            retrieval_dates: retrievalDates(f),
          },
        ];
      });
  });
}
export type ServiceMatch = ReturnType<typeof matchServices>[number];
export function buildCommercialPlan(
  findings: MatchFinding[],
  config: CommercialConfig = DEFAULT_COMMERCIAL_CONFIG,
  objective = "",
) {
  const matches = matchServices(findings, config);
  const services = configuredServices(config)
    .flatMap((service) => {
      const links = matches.filter((m) => m.service_id === service.id);
      if (!links.length) return [];
      return [
        {
          ...service,
          matches: links,
          priority: [...links].sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9))[0]!
            .priority,
        },
      ];
    })
    .sort(
      (a, b) =>
        PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) ||
        (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9),
    );
  const bundles = config.bundles
    .filter((b) => b.enabled)
    .flatMap((bundle) => {
      const components = services.filter((s) => bundle.serviceIds.includes(s.id)).map((s) => s.id);
      // Partial bundles are quoted again; never reuse a full-package price.
      return components.length >= 2
        ? [
            {
              ...bundle,
              serviceIds: components,
              pricing:
                components.length === bundle.serviceIds.length
                  ? bundle.pricing
                  : { quoteRequired: true, amount: null, currency: null },
            },
          ]
        : [];
    });
  return {
    objective,
    matches,
    services,
    bundles,
    phases: PHASES.map((phase) => ({
      phase,
      serviceIds: services.filter((s) => s.phase === phase).map((s) => s.id),
    })),
  };
}
export type CommercialPlan = ReturnType<typeof buildCommercialPlan>;
export const proposalSchema = z
  .object({
    title: prose.min(1).max(200),
    objective: prose,
    scope: prose,
    timeline: prose,
    serviceIds: z
      .array(z.string())
      .min(1)
      .max(21)
      .refine((v) => new Set(v).size === v.length, "Duplicate service"),
    deliverables: z.array(prose.min(1)).min(1).max(60),
    dependencies: z.array(prose).max(60),
    successIndicators: z.array(prose).max(60),
    terms: prose,
    exclusions: prose,
    pricing: pricingSchema,
  })
  .strict()
  .refine(
    (p) => !unsafeClaims(JSON.stringify(p)),
    "Remove guarantees and unsupported publisher relationships",
  );
export type ProposalDraft = z.infer<typeof proposalSchema>;
export function proposalDraft(plan: CommercialPlan, author: string, book: string): ProposalDraft {
  if (!plan.services.length)
    throw new Error("No evidence-supported services are ready for a proposal.");
  return proposalSchema.parse({
    title: `HQ360 proposal for ${book}`,
    objective: plan.objective,
    scope: `Proposed work for ${author}: ${plan.services.map((s) => s.name).join(", ")}. Confirm eligibility and scope before implementation.`,
    timeline: "",
    serviceIds: plan.services.map((s) => s.id),
    deliverables: [...new Set(plan.services.flatMap((s) => s.deliverables))],
    dependencies: [...new Set(plan.services.flatMap((s) => s.prerequisites))],
    successIndicators: plan.services.map((s) => s.primaryKpi),
    terms: "Scope, access, schedule and fees require agreement before work begins.",
    exclusions:
      "No guaranteed sales, rankings, bestseller status, votes, media placements or publishing agreements. Third-party approvals and fees require separate confirmation.",
    pricing: { quoteRequired: true, amount: null, currency: null },
  });
}
export function validateProposalServices(draft: ProposalDraft, plan: CommercialPlan) {
  if (draft.serviceIds.some((id) => !plan.services.some((s) => s.id === id)))
    throw new Error("Every selected service must be available and supported by a current finding.");
}

/** Stable projection extends old finding records without rewriting original facts. */
export function actionableFinding(f: MatchFinding, matches: ServiceMatch[]) {
  const links = matches.filter((m) => m.finding_id === f.id);
  return {
    ...f,
    finding_id: f.id,
    audit_area: f.category,
    finding_type: findingType(f),
    evidence_status: f.classification,
    observed_condition: f.what_we_found,
    evidence_summary: f.evidence,
    retrieval_dates: retrievalDates(f),
    reader_impact: f.commercial?.reader_impact ?? "",
    business_impact: f.commercial?.business_impact ?? "",
    confidence: f.confidence_score ?? null,
    recommended_service_ids: [...new Set(links.map((m) => m.service_id))],
    service_match_reasoning: links.map((m) => m.reason_for_match),
    expected_deliverables: links.map((m) => m.expected_deliverable),
    dependencies: links.length
      ? ["Confirm scope, eligibility, rights and access before implementation"]
      : [],
    proposed_next_action: f.commercial?.proposed_next_action || f.recommendation,
    service_mappings: links,
  };
}
