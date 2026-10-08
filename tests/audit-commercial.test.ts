import { expect, test } from "bun:test";
import ruth from "./fixtures/ruth-foster-audit.json";
import {
  actionableFinding,
  buildCommercialPlan,
  findingCommercialSchema,
  findingType,
  integrityIssues,
  matchServices,
  proposalDraft,
  proposalSchema,
  retrievalDates,
  validateProposalServices,
  type MatchFinding,
} from "../src/lib/author-audit/commercial";
import {
  SERVICES,
  DEFAULT_COMMERCIAL_CONFIG,
  commercialConfigSchema,
} from "../src/lib/author-audit/services";
const findings = ruth.findings as MatchFinding[];
const plan = buildCommercialPlan(findings);
test("catalogue has exactly 21 stable, configurable services and no invented prices", () => {
  expect(SERVICES).toHaveLength(21);
  expect(new Set(SERVICES.map((s) => s.id)).size).toBe(21);
  for (const s of SERVICES) {
    expect(s.pricing.amount).toBeNull();
    expect(s.pricing.quoteRequired).toBe(true);
    expect(s.requiredEvidence.length).toBeGreaterThan(0);
    expect(s.exclusions.length).toBeGreaterThan(0);
    expect(s.deliverables.length).toBeGreaterThan(0);
  }
  expect(
    commercialConfigSchema.safeParse({ ...DEFAULT_COMMERCIAL_CONFIG, services: { invented: {} } })
      .success,
  ).toBe(false);
});
test("Ruth Foster's saved facts, dates and citations survive the adapter unchanged", () => {
  const before = JSON.stringify(findings);
  for (const f of findings) {
    const result = actionableFinding(f, plan.matches);
    expect(result.observed_condition).toBe(f.what_we_found);
    expect(result.evidence_summary).toBe(f.evidence);
    expect(result.source_urls).toEqual(f.source_urls);
    expect(retrievalDates(f)).toContain("2026-10-07");
  }
  expect(JSON.stringify(findings)).toBe(before);
  const evidence = findings.map((f) => f.evidence).join("\n");
  for (const fact of [
    "Ollerford Publishing",
    "17 October 2024",
    "29 ratings",
    "13 reviews",
    "annual year-end letters",
    "Self-Published Winner",
    "Apple Books US and UK",
  ])
    expect(evidence).toContain(fact);
});
test("award supports media outreach; signup and Listopia opportunities stay conditional", () => {
  const award = findings.find((f) => f.title.includes("Verified 2025"))!;
  expect(findingType(award)).toBe("strength");
  expect(
    plan.matches.some((m) => m.finding_id === award.id && m.service_id === "podcast-press"),
  ).toBe(true);
  const signup = findings.find((f) => f.title.includes("newsletter capture"))!;
  expect(findingType(signup)).toBe("opportunity");
  expect(
    plan.matches.some((m) => m.finding_id === signup.id && m.service_id === "reader-magnet"),
  ).toBe(true);
  expect(plan.services.some((s) => s.id === "goodreads-listopia")).toBe(true);
  for (const m of plan.matches) {
    const f = findings.find((f) => f.id === m.finding_id)!;
    expect(f).toBeDefined();
    expect(m.supporting_evidence_ids.every((url) => f.source_urls.includes(url))).toBe(true);
    expect(m.eligibility_status).toBe("needs_confirmation");
  }
  expect(plan.services.find((s) => s.id === "podcast-press")!.matches.length).toBeGreaterThan(1);
});
test("low rank, unknown audio and a debut never trigger inappropriate services", () => {
  const excluded = [
    "amazon-keywords-categories",
    "amazon-listing",
    "amazon-a-plus",
    "backlist-revival",
    "audiobook",
    "distribution",
    "billboards",
  ];
  expect(plan.services.some((s) => excluded.includes(s.id))).toBe(false);
  expect(matchServices([{ ...findings[0]!, classification: "unknown" }])).toEqual([]);
  expect(matchServices([{ ...findings[0]!, source_urls: [] }])).toEqual([]);
  const rank = findings.find((f) => f.category === "amazon_audit")!;
  const invalid = {
    ...rank,
    commercial: findingCommercialSchema.parse({
      finding_type: "problem",
      signals: [
        { kind: "category_mismatch", source_url: rank.source_urls[0], excerpt: rank.evidence },
      ],
    }),
  };
  expect(integrityIssues(invalid).join(" ")).toContain("required condition");
  expect(matchServices([invalid])).toEqual([]);
});
test("unknown metrics remain null; invented metrics, claims and evidence are rejected", () => {
  const f = findings.find((f) => f.category === "media_and_authority")!;
  const c = findingCommercialSchema.parse({
    finding_type: "strength",
    metrics: [{ label: "sales", value: null, evidence: "", source_url: null }],
  });
  expect(c.metrics[0]!.value).toBeNull();
  expect(integrityIssues({ ...f, commercial: c })).toEqual([]);
  expect(
    integrityIssues({
      ...f,
      commercial: {
        ...c,
        metrics: [
          { label: "sales", value: 10000, evidence: "guessed", source_url: f.source_urls[0]! },
        ],
      },
    }).length,
  ).toBeGreaterThan(0);
  expect(
    integrityIssues({ ...f, recommendation: "We guarantee bestseller status and sales." }).length,
  ).toBeGreaterThan(0);
  expect(
    integrityIssues({ ...f, recommendation: "Our publisher connections will secure a deal." })
      .length,
  ).toBeGreaterThan(0);
  expect(integrityIssues({ ...f, what_we_found: "You lost 300 sales." }).length).toBeGreaterThan(0);
  expect(
    integrityIssues({
      ...f,
      classification: "possible_opportunity",
      commercial: { ...c, finding_type: "problem" },
    }).length,
  ).toBeGreaterThan(0);
});
test("disabled services, unsupported bundle components and quote assumptions are excluded", () => {
  const config = structuredClone(DEFAULT_COMMERCIAL_CONFIG);
  config.services["podcast-press"] = {
    enabled: false,
    pricing: SERVICES[0]!.pricing,
    landingUrl: null,
  };
  const filtered = buildCommercialPlan(findings, config);
  expect(filtered.services.some((s) => s.id === "podcast-press")).toBe(false);
  for (const b of filtered.bundles) {
    expect(b.serviceIds.length).toBeGreaterThanOrEqual(2);
    expect(b.serviceIds.every((id) => filtered.services.some((s) => s.id === id))).toBe(true);
    expect(b.pricing.amount).toBeNull();
  }
});
test("roadmap prepares foundations before acquisition and drafts never invent price/timeline", () => {
  const mediaKit = plan.services.findIndex((s) => s.id === "media-kit");
  const outreach = plan.services.findIndex((s) => s.id === "podcast-press");
  expect(mediaKit).toBeLessThan(outreach);
  const draft = proposalDraft(plan, "Ruth Foster", "A Perfect Year?");
  expect(draft.pricing.amount).toBeNull();
  expect(draft.timeline).toBe("");
  expect(() => validateProposalServices({ ...draft, serviceIds: ["billboards"] }, plan)).toThrow();
  expect(
    proposalSchema.safeParse({ ...draft, scope: "Guaranteed sales and bestseller status" }).success,
  ).toBe(false);
});
