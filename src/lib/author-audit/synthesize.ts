import Anthropic from "@anthropic-ai/sdk";
import { CAPABILITIES } from "@/data/capabilities";

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
  manualVerifications: { fieldKey: string; value: string | null; verificationStatus: string }[];
};

export type SynthesizedFinding = {
  section: string;
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
  /** Which evidence items (by index into the evidence array) back this finding. */
  evidenceRefs: number[];
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

export type SynthesisResult = {
  executiveSummary: string;
  strengths: string[];
  evidence: SynthesizedEvidence[];
  findings: SynthesizedFinding[];
};

const SYSTEM_PROMPT = `You are the evidence analyst for the HQ360 Author Visibility Audit — a paid, evidence-led assessment HQ360 sends directly to an author.

Your one job: turn the supplied research evidence into a structured audit. You are NOT a marketing copywriter and you must never invent, assume, or round up a fact that is not directly supported by the evidence you were given.

Hard rules, no exceptions:
1. Every finding must be traceable to specific evidence items you were given. Reference them by index in evidenceRefs.
2. If a research section has no evidence, or the evidence is inconclusive, the finding's status MUST be "unable_to_verify" and the observation must say plainly what could not be established and why (e.g. "No Goodreads data was supplied for this audit"). Never guess a plausible-sounding number or state.
3. Never recommend an HQ360 service because HQ360 sells it. Only set serviceOpportunity when the finding itself, on its own evidence, clearly points to a specific, relevant gap that service would close. Most findings should have serviceOpportunity: null.
4. Confidence and verificationStatus on evidence must reflect the actual source: an automated API lookup that matched cleanly is "verified"/"high"; a fuzzy match or an unverified manual entry is "likely" or "medium"; anything from a source that failed or was skipped is not evidence at all — do not fabricate a stand-in.
5. Write for the author, in plain, specific, non-hyped language. No superlatives that aren't earned by the evidence.
6. capabilitySlug in serviceOpportunity, when set, must be one of the following exactly: ${CAPABILITIES.map((c) => c.slug).join(", ")}.

Output must be a single call to the emit_audit tool with the full structured result. Do not include any other prose.`;

const TOOL_SCHEMA = {
  name: "emit_audit",
  description: "Emit the structured, evidence-backed author visibility audit.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["executiveSummary", "strengths", "evidence", "findings"],
    properties: {
      executiveSummary: {
        type: "string",
        description:
          "2-4 sentence plain-language summary of what was found, grounded only in evidence.",
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "Specific, evidence-backed strengths. Empty array if none are supported.",
      },
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
            "section",
            "observation",
            "status",
            "priority",
            "evidenceRefs",
            "serviceOpportunity",
          ],
          properties: {
            section: { type: "string" },
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
            serviceOpportunity: {
              type: ["object", "null"],
              properties: {
                capabilitySlug: { type: "string" },
                rationale: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

export async function synthesizeAudit(input: SynthesisEvidenceInput): Promise<SynthesisResult> {
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
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "emit_audit" },
    messages: [
      {
        role: "user",
        content: `Research evidence for this audit:\n\n${JSON.stringify(evidenceBundle, null, 2)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Model did not return a structured result");

  return toolUse.input as SynthesisResult;
}
