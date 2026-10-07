import Anthropic from "@anthropic-ai/sdk";
import { CAPABILITIES } from "@/data/capabilities";
import type {
  AuditComparable,
  AuditFinding,
  AuditReaderJourneyStep,
  AuditStrength,
  ExecutiveAssessment,
  Priority,
} from "./db";

const CAPABILITY_SLUGS = CAPABILITIES.map((c) => c.slug);

// ------------------------------------------------------------ phase A: findings

export type SynthesisEvidenceInput = {
  audit: { authorName: string; bookTitle: string; websiteUrl?: string | null };
  sources: {
    provider: string;
    sourceType: string;
    url?: string | null;
    status: string;
    data: Record<string, unknown>;
    error?: string | null;
  }[];
  manualVerifications: {
    fieldKey: string;
    section: string;
    value: string | null;
    verificationStatus: string;
  }[];
};

export type SynthesizedFinding = {
  title: string;
  category: string;
  observation: string;
  whyItMatters: string | null;
  recommendation: string | null;
  status:
    | "strong"
    | "healthy"
    | "opportunity_identified"
    | "needs_attention"
    | "critical_issue"
    | "unable_to_verify";
  priority: "immediate" | "high_impact" | "medium_priority" | "long_term" | "optional";
  effort: "low" | "medium" | "high" | null;
  potentialImpact: "low" | "medium" | "high" | null;
  evidenceRefs: number[];
  sourceUrls: string[];
  /** Only when a genuine, specific HQ360 service fits — never forced. */
  serviceOpportunity: { capabilitySlug: string; rationale: string } | null;
};

export type SynthesizedEvidence = {
  section: string;
  claim: string;
  excerpt: string | null;
  url: string | null;
  verificationStatus: "verified" | "likely" | "unverified" | "conflicting";
  confidence: "high" | "medium" | "low";
};

export type SynthesizedStrength = {
  title: string;
  observation: string;
  evidence: string | null;
  sourceUrls: string[];
};

export type SynthesizedJourneyStep = {
  stage:
    | "discovery"
    | "interest"
    | "trust"
    | "book_information"
    | "purchase"
    | "follow"
    | "owned_audience"
    | "next_book";
  status:
    "strong" | "functional" | "friction_identified" | "opportunity_identified" | "unable_to_verify";
  observation: string;
  evidence: string | null;
  friction: string | null;
  recommendation: string | null;
};

export type FindingsSynthesisResult = {
  evidence: SynthesizedEvidence[];
  findings: SynthesizedFinding[];
  strengths: SynthesizedStrength[];
  readerJourney: SynthesizedJourneyStep[];
};

const FINDINGS_SYSTEM_PROMPT = `You are the evidence analyst for the HQ360 Author Visibility Audit — a premium, paid assessment HQ360 sends directly to an author who may already have asked an AI tool to analyze their own book. The value HQ360 adds is real research, verified evidence and disciplined interpretation — not generic AI marketing advice. You must justify that difference in every line you write.

Hard rules, no exceptions:
1. Every finding, strength and journey-stage observation must be traceable to specific evidence you were given (automated source data or a staff manual-verification entry). Reference evidence items by index in evidenceRefs.
2. If a research area has no evidence, or the evidence is inconclusive, the finding's status MUST be "unable_to_verify" (or the journey stage status "unable_to_verify") and the text must say plainly what could not be established and why. Never guess a plausible-sounding number, ranking, or state. Never say "the author has no X" — say "no publicly visible X was identified during this audit."
3. Never recommend an HQ360 service because HQ360 sells it. Only set serviceOpportunity when the finding itself, on its own evidence, clearly points to a specific, relevant gap that service would close. Most findings should have serviceOpportunity: null. Valid capabilitySlug values: ${CAPABILITY_SLUGS.join(", ")}.
4. Confidence and verificationStatus on evidence must reflect the actual source: an automated API lookup that matched cleanly is "verified"/"high"; a fuzzy match or an unverified manual entry is "likely" or "medium"; anything from a source that failed or was skipped is not evidence at all — do not fabricate a stand-in.
5. Never fabricate sales, revenue, conversion rates, Amazon ranking beyond what was supplied, hidden keywords, reader demographics, ad campaigns, mailing list size, publisher relationships, awards, reviews, or media coverage that wasn't in the evidence.
6. Produce a serious "what is already working" set of strengths grounded in evidence — an audit should not conclude everything needs fixing when the evidence doesn't support that.
7. Reader journey: evaluate all 8 stages (discovery, interest, trust, book_information, purchase, follow, owned_audience, next_book) using only the evidence given. A stage with no supporting evidence is "unable_to_verify", not assumed broken.
8. Write for the author, in plain, specific, non-hyped language. No superlatives that aren't earned by the evidence. No arbitrary scores or percentages.

Output must be a single call to the emit_findings tool. Do not include any other prose.`;

const FINDINGS_TOOL_SCHEMA = {
  name: "emit_findings",
  description:
    "Emit the structured, evidence-backed findings, strengths and reader-journey analysis.",
  input_schema: {
    type: "object" as const,
    required: ["evidence", "findings", "strengths", "readerJourney"],
    properties: {
      evidence: {
        type: "array",
        items: {
          type: "object",
          required: ["section", "claim", "verificationStatus", "confidence"],
          properties: {
            section: { type: "string" },
            claim: { type: "string" },
            excerpt: { type: ["string", "null"] },
            url: { type: ["string", "null"] },
            verificationStatus: {
              type: "string",
              enum: ["verified", "likely", "unverified", "conflicting"],
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: [
            "title",
            "category",
            "observation",
            "status",
            "priority",
            "evidenceRefs",
            "sourceUrls",
            "serviceOpportunity",
          ],
          properties: {
            title: {
              type: "string",
              description:
                "Short, specific finding title, e.g. 'No visible newsletter signup on homepage'",
            },
            category: {
              type: "string",
              enum: [
                "Book presence",
                "Amazon",
                "Goodreads",
                "Search visibility",
                "Author website",
                "Social",
                "Media & authority",
                "Owned audience",
              ],
            },
            observation: { type: "string" },
            whyItMatters: { type: ["string", "null"] },
            recommendation: { type: ["string", "null"] },
            status: {
              type: "string",
              enum: [
                "strong",
                "healthy",
                "opportunity_identified",
                "needs_attention",
                "critical_issue",
                "unable_to_verify",
              ],
            },
            priority: {
              type: "string",
              enum: ["immediate", "high_impact", "medium_priority", "long_term", "optional"],
            },
            effort: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
            potentialImpact: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
            evidenceRefs: { type: "array", items: { type: "integer" } },
            sourceUrls: { type: "array", items: { type: "string" } },
            serviceOpportunity: {
              type: ["object", "null"],
              properties: { capabilitySlug: { type: "string" }, rationale: { type: "string" } },
            },
          },
        },
      },
      strengths: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "observation"],
          properties: {
            title: { type: "string" },
            observation: { type: "string" },
            evidence: { type: ["string", "null"] },
            sourceUrls: { type: "array", items: { type: "string" } },
          },
        },
      },
      readerJourney: {
        type: "array",
        items: {
          type: "object",
          required: ["stage", "status", "observation"],
          properties: {
            stage: {
              type: "string",
              enum: [
                "discovery",
                "interest",
                "trust",
                "book_information",
                "purchase",
                "follow",
                "owned_audience",
                "next_book",
              ],
            },
            status: {
              type: "string",
              enum: [
                "strong",
                "functional",
                "friction_identified",
                "opportunity_identified",
                "unable_to_verify",
              ],
            },
            observation: { type: "string" },
            evidence: { type: ["string", "null"] },
            friction: { type: ["string", "null"] },
            recommendation: { type: ["string", "null"] },
          },
        },
      },
    },
  },
};

export async function synthesizeAudit(
  input: SynthesisEvidenceInput,
): Promise<FindingsSynthesisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  const evidenceBundle = {
    author: input.audit.authorName,
    book: input.audit.bookTitle,
    website: input.audit.websiteUrl ?? null,
    automatedSources: input.sources,
    manualVerifications: input.manualVerifications,
  };

  const message = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: FINDINGS_SYSTEM_PROMPT,
    tools: [FINDINGS_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "emit_findings" },
    messages: [
      {
        role: "user",
        content: `Research evidence for this audit:\n\n${JSON.stringify(evidenceBundle, null, 2)}`,
      },
    ],
  });

  if (message.stop_reason === "max_tokens")
    throw new Error("Model output was truncated before finishing — try again");

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Model did not return a structured result");
  const result = toolUse.input as Partial<FindingsSynthesisResult>;
  return {
    evidence: result.evidence ?? [],
    findings: result.findings ?? [],
    strengths: result.strengths ?? [],
    readerJourney: result.readerJourney ?? [],
  };
}

// ------------------------------------------------------ phase B: strategic plan

export type StrategicPlanInput = {
  audit: { authorName: string; bookTitle: string };
  approvedFindings: Pick<
    AuditFinding,
    | "id"
    | "title"
    | "category"
    | "observation"
    | "why_it_matters"
    | "recommendation"
    | "status"
    | "priority"
  >[];
  approvedStrengths: Pick<AuditStrength, "title" | "observation">[];
  approvedJourney: Pick<AuditReaderJourneyStep, "stage" | "status" | "observation" | "friction">[];
  approvedComparables: Pick<
    AuditComparable,
    | "author"
    | "book"
    | "why_comparable"
    | "reader_pathway_notes"
    | "newsletter_notes"
    | "positioning_notes"
  >[];
};

export type SynthesizedMove = {
  rank: 1 | 2 | 3;
  title: string;
  whatWeFound: string;
  evidence: string | null;
  whatWeWouldChange: string;
  whyFirst: string;
  enablesNext: string | null;
  successIndicator: string | null;
  capabilitySlug: string | null;
  basedOnFindingIds: string[];
};

export type SynthesizedRoadmapItem = {
  week: 1 | 2 | 3 | 4;
  action: string;
  reason: string | null;
  dependency: string | null;
  priority: Priority | null;
  capabilitySlug: string | null;
  completionIndicator: string | null;
  basedOnFindingIds: string[];
};

export type StrategicPlanResult = {
  executiveAssessment: ExecutiveAssessment;
  moves: SynthesizedMove[];
  roadmap: SynthesizedRoadmapItem[];
};

const PLAN_SYSTEM_PROMPT = `You are HQ360's strategist, building the strategic layer of an Author Visibility Audit from findings HQ360 staff have ALREADY reviewed and approved for the client. You are not re-researching — you are sequencing and explaining decisions HQ360 would actually make.

Hard rules:
1. Use ONLY the approved findings, strengths, reader-journey stages and comparables you are given. Do not introduce new claims, facts or evidence that isn't already present in what you were given.
2. "The 3 moves we would make first" must be chosen from the approved findings — pick the sequence with the strongest strategic logic (what unblocks what), not simply the first three by priority. Reference which finding IDs each move is based on in basedOnFindingIds. If fewer than 3 approved findings genuinely warrant a move, return fewer than 3 — never pad to reach 3.
3. The 30-day roadmap must be built only from approved recommendations. Do not invent tasks to fill four weeks — if there isn't a full month of real, evidence-backed work, say so by returning fewer items. Week labels (Foundation/Implementation/Visibility/Measurement) are a default shape, not a requirement — sequence by real dependency.
4. Never promise sales, rankings, revenue or bestseller status. "successIndicator" and "completionIndicator" must be about a verifiable state existing (e.g. "a signup form is visible above the fold"), not an outcome HQ360 can't control.
5. The executive assessment must reference the actual approved material you were given — no generic statements like "with the right strategy this book has great potential." Answer plainly: what's working, the strongest verified opportunities, where the reader journey breaks, patterns from comparables (if any were supplied), what deserves attention first, what should NOT be changed, and what remains unknown.
6. A capability suggestion in a move or roadmap item is only ever an HQ360 service reference (from: ${CAPABILITY_SLUGS.join(", ")}), never pricing, sales framing or urgency language.
7. It is a completely valid, correct output for moves or roadmap to conclude the current approved findings don't yet support a confident sequence — return an honest, shorter result rather than force one.

Output must be a single call to the emit_plan tool. Do not include any other prose.`;

const PLAN_TOOL_SCHEMA = {
  name: "emit_plan",
  description: "Emit the executive assessment, the 3 moves, and the 30-day roadmap.",
  input_schema: {
    type: "object" as const,
    required: ["executiveAssessment", "moves", "roadmap"],
    properties: {
      executiveAssessment: {
        type: "object",
        required: [
          "whatIsWorking",
          "strongestOpportunities",
          "journeyBreaks",
          "comparablePatterns",
          "priorityFirst",
          "doNotChange",
          "unknowns",
        ],
        properties: {
          whatIsWorking: { type: "string" },
          strongestOpportunities: { type: "string" },
          journeyBreaks: { type: "string" },
          comparablePatterns: {
            type: "string",
            description: "Empty string if no comparables were supplied.",
          },
          priorityFirst: { type: "string" },
          doNotChange: { type: "string" },
          unknowns: { type: "string" },
        },
      },
      moves: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          required: [
            "rank",
            "title",
            "whatWeFound",
            "whatWeWouldChange",
            "whyFirst",
            "basedOnFindingIds",
          ],
          properties: {
            rank: { type: "integer", enum: [1, 2, 3] },
            title: { type: "string" },
            whatWeFound: { type: "string" },
            evidence: { type: ["string", "null"] },
            whatWeWouldChange: { type: "string" },
            whyFirst: { type: "string" },
            enablesNext: { type: ["string", "null"] },
            successIndicator: { type: ["string", "null"] },
            capabilitySlug: { type: ["string", "null"] },
            basedOnFindingIds: { type: "array", items: { type: "string" } },
          },
        },
      },
      roadmap: {
        type: "array",
        items: {
          type: "object",
          required: ["week", "action", "basedOnFindingIds"],
          properties: {
            week: { type: "integer", enum: [1, 2, 3, 4] },
            action: { type: "string" },
            reason: { type: ["string", "null"] },
            dependency: { type: ["string", "null"] },
            priority: {
              type: ["string", "null"],
              enum: ["immediate", "high_impact", "medium_priority", "long_term", "optional", null],
            },
            capabilitySlug: { type: ["string", "null"] },
            completionIndicator: { type: ["string", "null"] },
            basedOnFindingIds: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
};

export async function synthesizeStrategicPlan(
  input: StrategicPlanInput,
): Promise<StrategicPlanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 10000,
    system: PLAN_SYSTEM_PROMPT,
    tools: [PLAN_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "emit_plan" },
    messages: [
      {
        role: "user",
        content: `Approved material for ${input.audit.authorName} — ${input.audit.bookTitle}:\n\n${JSON.stringify(
          {
            findings: input.approvedFindings,
            strengths: input.approvedStrengths,
            readerJourney: input.approvedJourney,
            comparables: input.approvedComparables,
          },
          null,
          2,
        )}`,
      },
    ],
  });

  if (message.stop_reason === "max_tokens")
    throw new Error("Model output was truncated before finishing — try again");

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Model did not return a structured result");
  const result = toolUse.input as Partial<StrategicPlanResult>;
  return {
    executiveAssessment: result.executiveAssessment ?? {
      whatIsWorking: "",
      strongestOpportunities: "",
      journeyBreaks: "",
      comparablePatterns: "",
      priorityFirst: "",
      doNotChange: "",
      unknowns: "",
    },
    moves: result.moves ?? [],
    roadmap: result.roadmap ?? [],
  };
}
