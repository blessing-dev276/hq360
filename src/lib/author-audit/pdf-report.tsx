import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { BRAND } from "@/config/brand";
import type { AuditEvidence, AuditFinding } from "./db";

const BRAND_ORANGE = "#e2571f";
const INK = "#161311";
const MUTED = "#6b6560";
const BORDER = "#e4ddd4";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", color: INK, lineHeight: 1.5 },
  coverPage: {
    padding: 56,
    fontFamily: "Helvetica",
    color: "#fff",
    backgroundColor: "#161311",
    justifyContent: "space-between",
  },
  coverEyebrow: { fontSize: 11, letterSpacing: 2, color: BRAND_ORANGE, marginBottom: 16 },
  coverTitle: { fontSize: 30, fontFamily: "Helvetica-Bold", lineHeight: 1.25 },
  coverSubtitle: { fontSize: 14, marginTop: 18, color: "#d8d2c8" },
  coverMeta: { fontSize: 9, color: "#a39c92" },
  h1: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    color: INK,
    borderBottom: `2px solid ${BRAND_ORANGE}`,
    paddingBottom: 8,
  },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  p: { marginBottom: 8 },
  muted: { color: MUTED },
  strengthRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: { width: 14, color: BRAND_ORANGE, fontFamily: "Helvetica-Bold" },
  card: {
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  badge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    color: "#fff",
  },
  fieldLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: MUTED,
    marginTop: 6,
    textTransform: "uppercase",
  },
  fieldValue: { fontSize: 10, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: MUTED,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1px solid ${BORDER}`,
    paddingTop: 6,
  },
});

const STATUS_COLOR: Record<AuditFinding["status"], string> = {
  strong: "#1f8a4c",
  healthy: "#3d8a5f",
  opportunity_identified: BRAND_ORANGE,
  needs_attention: "#c2410c",
  critical_issue: "#b91c1c",
  unable_to_verify: "#78716c",
};

const STATUS_LABEL: Record<AuditFinding["status"], string> = {
  strong: "Strong",
  healthy: "Healthy",
  opportunity_identified: "Opportunity",
  needs_attention: "Needs attention",
  critical_issue: "Critical",
  unable_to_verify: "Unable to verify",
};

const PRIORITY_LABEL: Record<AuditFinding["priority"], string> = {
  immediate: "Immediate",
  high_impact: "High impact",
  medium_priority: "Medium priority",
  long_term: "Long term",
  optional: "Optional",
};

function Footer({ page }: { page: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {BRAND.name} Author Visibility Audit — Confidential, prepared for the named author only
      </Text>
      <Text render={({ pageNumber, totalPages }) => `${page} — ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function AuditPdfDocument({
  authorName,
  bookTitle,
  preparedDate,
  executiveSummary,
  strengths,
  findings,
  evidence,
}: {
  authorName: string;
  bookTitle: string;
  preparedDate: string;
  executiveSummary: string;
  strengths: string[];
  findings: AuditFinding[];
  evidence: AuditEvidence[];
}) {
  const priorityOrder: AuditFinding["priority"][] = [
    "immediate",
    "high_impact",
    "medium_priority",
    "long_term",
    "optional",
  ];
  const sortedFindings = [...findings].sort(
    (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority),
  );
  const priorityOpportunities = sortedFindings.filter(
    (f) =>
      f.status === "opportunity_identified" ||
      f.status === "needs_attention" ||
      f.status === "critical_issue",
  );
  const evidenceBySection = new Map<string, AuditEvidence[]>();
  for (const e of evidence) {
    const list = evidenceBySection.get(e.section) ?? [];
    list.push(e);
    evidenceBySection.set(e.section, list);
  }

  return (
    <Document title={`${BRAND.name} Author Visibility Audit — ${authorName}`}>
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        <View>
          <Text style={styles.coverEyebrow}>
            {BRAND.name.toUpperCase()} · AUTHOR VISIBILITY AUDIT
          </Text>
          <Text style={styles.coverTitle}>{bookTitle}</Text>
          <Text style={styles.coverSubtitle}>{authorName}</Text>
        </View>
        <View>
          <Text style={styles.coverMeta}>Prepared {preparedDate}</Text>
          <Text style={styles.coverMeta}>{BRAND.email}</Text>
        </View>
      </Page>

      {/* Executive summary + strengths */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Executive summary</Text>
        <Text style={styles.p}>{executiveSummary}</Text>

        <Text style={styles.h2}>Strengths</Text>
        {strengths.length === 0 ? (
          <Text style={[styles.p, styles.muted]}>
            No strengths could be established with confidence from the evidence gathered.
          </Text>
        ) : (
          strengths.map((s, i) => (
            <View key={i} style={styles.strengthRow}>
              <Text style={styles.bullet}>—</Text>
              <Text style={{ flex: 1 }}>{s}</Text>
            </View>
          ))
        )}

        <Text style={styles.h2}>Priority opportunities</Text>
        {priorityOpportunities.length === 0 ? (
          <Text style={[styles.p, styles.muted]}>
            No specific opportunities could be established with confidence from the evidence
            gathered.
          </Text>
        ) : (
          priorityOpportunities.slice(0, 5).map((f) => (
            <View key={f.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{f.section}</Text>
                <Text style={[styles.badge, { backgroundColor: STATUS_COLOR[f.status] }]}>
                  {PRIORITY_LABEL[f.priority]}
                </Text>
              </View>
              <Text>{f.observation}</Text>
            </View>
          ))
        )}
        <Footer page="Executive summary" />
      </Page>

      {/* Detailed findings */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Detailed findings</Text>
        {sortedFindings.map((f) => (
          <View key={f.id} style={styles.card} wrap={false}>
            <View style={styles.cardHeader}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{f.section}</Text>
              <Text style={[styles.badge, { backgroundColor: STATUS_COLOR[f.status] }]}>
                {STATUS_LABEL[f.status]}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Observed</Text>
            <Text style={styles.fieldValue}>{f.observation}</Text>

            {f.why_it_matters ? (
              <>
                <Text style={styles.fieldLabel}>Why it matters</Text>
                <Text style={styles.fieldValue}>{f.why_it_matters}</Text>
              </>
            ) : null}

            {f.recommendation ? (
              <>
                <Text style={styles.fieldLabel}>Recommendation</Text>
                <Text style={styles.fieldValue}>{f.recommendation}</Text>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>Priority / effort</Text>
            <Text style={styles.fieldValue}>
              {PRIORITY_LABEL[f.priority]}
              {f.effort ? ` · ${f.effort} effort` : ""}
              {f.potential_impact ? ` · ${f.potential_impact} potential impact` : ""}
            </Text>
          </View>
        ))}
        <Footer page="Detailed findings" />
      </Page>

      {/* Evidence appendix */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Evidence</Text>
        <Text style={[styles.p, styles.muted]}>
          Every finding above is grounded in one or more of the items below. Anything not listed
          here was not established and is marked accordingly in the findings.
        </Text>
        {[...evidenceBySection.entries()].map(([section, items]) => (
          <View key={section}>
            <Text style={styles.h2}>{section}</Text>
            {items.map((e) => (
              <View key={e.id} style={styles.card}>
                <Text>{e.claim}</Text>
                {e.excerpt ? <Text style={[styles.p, styles.muted]}>“{e.excerpt}”</Text> : null}
                {e.url ? <Text style={styles.muted}>{e.url}</Text> : null}
                <Text style={[styles.muted, { fontSize: 8, marginTop: 4 }]}>
                  {e.verification_status} · {e.confidence} confidence
                </Text>
              </View>
            ))}
          </View>
        ))}
        <Footer page="Evidence" />
      </Page>
    </Document>
  );
}

// Server-only module (rendered inside API routes) — fast refresh doesn't apply.
// eslint-disable-next-line react-refresh/only-export-components
export async function renderAuditPdf(
  props: Parameters<typeof AuditPdfDocument>[0],
): Promise<Buffer> {
  return renderToBuffer(<AuditPdfDocument {...props} />);
}
