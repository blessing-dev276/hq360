import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { BRAND } from "@/config/brand";
import { CAPABILITIES } from "@/data/capabilities";
import { READER_JOURNEY_STAGE_LABEL } from "./reader-journey-labels";
import type { AuditFinding } from "./db";
import type { ReportData } from "./report-data";

const ORANGE = "#FF5A00";
const INK = "#111416";
const MUTED = "#6b6560";
const BORDER = "#e4ddd4";
const CAPABILITY_LABEL = new Map<string, string>(CAPABILITIES.map((c) => [c.slug, c.name]));

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", color: INK, lineHeight: 1.5 },
  coverPage: {
    padding: 56,
    fontFamily: "Helvetica",
    color: "#fff",
    backgroundColor: INK,
    justifyContent: "space-between",
  },
  coverEyebrow: { fontSize: 11, letterSpacing: 2, color: ORANGE, marginBottom: 16 },
  coverWordmark: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 28 },
  coverTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", lineHeight: 1.25 },
  coverSubtitle: { fontSize: 14, marginTop: 10, color: "#d8d2c8" },
  coverMetaBlock: { marginTop: 40, gap: 4 },
  coverMetaLabel: { fontSize: 8, letterSpacing: 1.5, color: "#a39c92", textTransform: "uppercase" },
  coverMetaValue: { fontSize: 11, color: "#fff", marginBottom: 8 },
  coverFooter: { fontSize: 9, color: "#a39c92" },
  sectionNumber: { fontSize: 10, color: ORANGE, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h1: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    color: INK,
    borderBottom: `2px solid ${ORANGE}`,
    paddingBottom: 8,
  },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  p: { marginBottom: 8 },
  muted: { color: MUTED },
  small: { fontSize: 8.5 },
  bullet: { width: 14, color: ORANGE, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row" },
  card: { border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, gap: 8 },
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
  table: { border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderBottom: `1px solid ${BORDER}` },
  tableRowLast: { flexDirection: "row" },
  tableCellHead: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#f6f2ec",
  },
  tableCell: { flex: 1, padding: 6, fontSize: 8.5 },
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
  opportunity_identified: ORANGE,
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
  high_impact: "High priority",
  medium_priority: "Medium priority",
  long_term: "Long term",
  optional: "Optional",
};
const JOURNEY_STATUS_COLOR: Record<string, string> = {
  strong: "#1f8a4c",
  functional: "#3d8a5f",
  friction_identified: "#c2410c",
  opportunity_identified: ORANGE,
  unable_to_verify: "#78716c",
};
const JOURNEY_STATUS_LABEL: Record<string, string> = {
  strong: "Strong",
  functional: "Functional",
  friction_identified: "Friction identified",
  opportunity_identified: "Opportunity identified",
  unable_to_verify: "Unable to verify",
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

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <>
      <Text style={styles.sectionNumber}>{number}</Text>
      <Text style={styles.h1}>{title}</Text>
    </>
  );
}

function Badge({ color, children }: { color: string; children: string }) {
  return <Text style={[styles.badge, { backgroundColor: color }]}>{children}</Text>;
}

function EmptyNote({ children }: { children: string }) {
  return <Text style={[styles.p, styles.muted]}>{children}</Text>;
}

export function AuditPdfDocument({ data }: { data: ReportData }) {
  const priorityOrder: AuditFinding["priority"][] = [
    "immediate",
    "high_impact",
    "medium_priority",
    "long_term",
    "optional",
  ];
  const sortedFindings = [...data.findings].sort(
    (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority),
  );
  const opportunities = sortedFindings.filter((f) => f.status === "opportunity_identified");
  const unverifiable = sortedFindings.filter((f) => f.status === "unable_to_verify");
  const findingsByCategory = new Map<string, AuditFinding[]>();
  for (const f of sortedFindings) {
    const key = f.category ?? f.section;
    findingsByCategory.set(key, [...(findingsByCategory.get(key) ?? []), f]);
  }
  const roadmapByWeek = new Map<number, typeof data.roadmap>();
  for (const item of data.roadmap) {
    roadmapByWeek.set(item.week, [...(roadmapByWeek.get(item.week) ?? []), item]);
  }
  const ea = data.executiveAssessment;
  const preparedFor = data.author.name;

  return (
    <Document title={`${BRAND.name} Author Visibility Audit — ${data.author.name}`}>
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        <View>
          <Text style={styles.coverWordmark}>{BRAND.name}</Text>
          <Text style={styles.coverEyebrow}>AUTHOR VISIBILITY &amp; GROWTH AUDIT</Text>
          <Text style={styles.coverTitle}>{data.book.title}</Text>
          <Text style={styles.coverSubtitle}>{data.author.name}</Text>
        </View>
        <View style={styles.coverMetaBlock}>
          <Text style={styles.coverMetaLabel}>Prepared specifically for</Text>
          <Text style={styles.coverMetaValue}>{preparedFor}</Text>
          <Text style={styles.coverMetaLabel}>Prepared by</Text>
          <Text style={styles.coverMetaValue}>
            {BRAND.name}
            {data.preparedByStaffName ? ` — ${data.preparedByStaffName}` : ""}
          </Text>
          <Text style={styles.coverMetaLabel}>Audit date</Text>
          <Text style={styles.coverMetaValue}>{data.preparedDate}</Text>
          <Text style={[styles.coverFooter, { marginTop: 8 }]}>
            Confidential — prepared for {preparedFor}. Not for redistribution.
          </Text>
        </View>
      </Page>

      {/* 01 Executive Assessment */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="01" title="Executive assessment" />
        {ea ? (
          <>
            <Text style={styles.h2}>What is already working</Text>
            <Text style={styles.p}>{ea.whatIsWorking}</Text>
            <Text style={styles.h2}>Strongest verified opportunities</Text>
            <Text style={styles.p}>{ea.strongestOpportunities}</Text>
            <Text style={styles.h2}>Where the reader journey breaks or weakens</Text>
            <Text style={styles.p}>{ea.journeyBreaks}</Text>
            {ea.comparablePatterns ? (
              <>
                <Text style={styles.h2}>Patterns from comparable books/authors</Text>
                <Text style={styles.p}>{ea.comparablePatterns}</Text>
              </>
            ) : null}
            <Text style={styles.h2}>What deserves attention first</Text>
            <Text style={styles.p}>{ea.priorityFirst}</Text>
            <Text style={styles.h2}>What should not be changed</Text>
            <Text style={styles.p}>{ea.doNotChange}</Text>
            <Text style={styles.h2}>What remains unknown or unverifiable</Text>
            <Text style={styles.p}>{ea.unknowns}</Text>
          </>
        ) : (
          <EmptyNote>Executive assessment has not been approved for this report yet.</EmptyNote>
        )}
        <Footer page="Executive assessment" />
      </Page>

      {/* 02 What is already working */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="02" title="What is already working" />
        {data.strengths.length === 0 ? (
          <EmptyNote>
            No strengths were approved with strong enough evidence for this report.
          </EmptyNote>
        ) : (
          data.strengths.map((s) => (
            <View key={s.id} style={styles.card} wrap={false}>
              <View style={styles.cardHeader}>
                <Text style={{ fontFamily: "Helvetica-Bold", flex: 1 }}>{s.title}</Text>
                {s.disposition ? (
                  <Badge color="#1f8a4c">
                    {s.disposition === "preserve"
                      ? "Preserve"
                      : s.disposition === "build_upon"
                        ? "Build upon"
                        : "No change needed"}
                  </Badge>
                ) : null}
              </View>
              <Text>{s.observation}</Text>
              {s.evidence ? (
                <Text style={[styles.small, styles.muted, { marginTop: 4 }]}>
                  Evidence: {s.evidence}
                </Text>
              ) : null}
            </View>
          ))
        )}
        <Footer page="What is already working" />
      </Page>

      {/* 03 Current visibility landscape */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="03" title="Current visibility landscape" />
        {[...findingsByCategory.entries()].map(([category, items]) => (
          <View key={category} style={{ marginBottom: 14 }} wrap={false}>
            <Text style={styles.h2}>{category}</Text>
            {items.map((f) => (
              <View key={f.id} style={styles.row}>
                <Badge color={STATUS_COLOR[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                <Text style={{ marginLeft: 8, flex: 1 }}>
                  {f.title ?? f.observation.slice(0, 90)}
                </Text>
              </View>
            ))}
          </View>
        ))}
        <Footer page="Current visibility landscape" />
      </Page>

      {/* 04 Reader journey */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="04" title="Reader journey" />
        {data.readerJourney.length === 0 ? (
          <EmptyNote>Reader-journey analysis has not been approved for this report yet.</EmptyNote>
        ) : (
          data.readerJourney.map((j) => (
            <View key={j.id} style={styles.card} wrap={false}>
              <View style={styles.cardHeader}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {READER_JOURNEY_STAGE_LABEL[j.stage]}
                </Text>
                <Badge color={JOURNEY_STATUS_COLOR[j.status] ?? MUTED}>
                  {JOURNEY_STATUS_LABEL[j.status] ?? j.status}
                </Badge>
              </View>
              <Text>{j.observation}</Text>
              {j.friction ? <Text style={[styles.fieldLabel]}>Friction</Text> : null}
              {j.friction ? <Text style={styles.fieldValue}>{j.friction}</Text> : null}
              {j.recommendation ? <Text style={styles.fieldLabel}>Recommendation</Text> : null}
              {j.recommendation ? <Text style={styles.fieldValue}>{j.recommendation}</Text> : null}
            </View>
          ))
        )}
        <Footer page="Reader journey" />
      </Page>

      {/* 05 Comparable market analysis */}
      {data.comparables.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <SectionHeading number="05" title="Comparable market analysis" />
          <EmptyNote>
            Reviewed for patterns and positioning — not a ranking of one author against another.
          </EmptyNote>
          {data.comparables.map((c) => (
            <View key={c.id} style={styles.card} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {c.author}
                {c.book ? ` — ${c.book}` : ""}
              </Text>
              <Text style={[styles.small, styles.muted, { marginTop: 2 }]}>{c.why_comparable}</Text>
              {c.reader_pathway_notes ? (
                <Text style={styles.fieldLabel}>Reader pathway</Text>
              ) : null}
              {c.reader_pathway_notes ? (
                <Text style={styles.fieldValue}>{c.reader_pathway_notes}</Text>
              ) : null}
              {c.newsletter_notes ? <Text style={styles.fieldLabel}>Owned audience</Text> : null}
              {c.newsletter_notes ? (
                <Text style={styles.fieldValue}>{c.newsletter_notes}</Text>
              ) : null}
            </View>
          ))}
          <Footer page="Comparable market analysis" />
        </Page>
      ) : null}

      {/* 06 Priority findings */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="06" title="Priority findings" />
        {sortedFindings.map((f) => (
          <View key={f.id} style={styles.card} wrap={false}>
            <View style={styles.cardHeader}>
              <Text style={{ fontFamily: "Helvetica-Bold", flex: 1 }}>{f.title ?? f.category}</Text>
              <Badge color={STATUS_COLOR[f.status]}>{STATUS_LABEL[f.status]}</Badge>
            </View>
            <Text style={styles.fieldLabel}>Observed</Text>
            <Text style={styles.fieldValue}>{f.observation}</Text>
            {f.why_it_matters ? <Text style={styles.fieldLabel}>Why it matters</Text> : null}
            {f.why_it_matters ? <Text style={styles.fieldValue}>{f.why_it_matters}</Text> : null}
            {f.recommendation ? <Text style={styles.fieldLabel}>Recommended action</Text> : null}
            {f.recommendation ? <Text style={styles.fieldValue}>{f.recommendation}</Text> : null}
            <Text style={styles.fieldLabel}>Priority / effort / potential impact</Text>
            <Text style={styles.fieldValue}>
              {PRIORITY_LABEL[f.priority]}
              {f.effort ? ` · ${f.effort} effort` : ""}
              {f.potential_impact ? ` · ${f.potential_impact} potential impact` : ""}
            </Text>
            {f.capability_slug && CAPABILITY_LABEL.has(f.capability_slug) ? (
              <>
                <Text style={styles.fieldLabel}>Relevant HQ360 capability</Text>
                <Text style={styles.fieldValue}>{CAPABILITY_LABEL.get(f.capability_slug)}</Text>
              </>
            ) : null}
          </View>
        ))}
        <Footer page="Priority findings" />
      </Page>

      {/* 07 Underused / missed opportunities */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="07" title="Underused / missed opportunities" />
        {opportunities.length === 0 ? (
          <EmptyNote>No specific missed opportunities were established with confidence.</EmptyNote>
        ) : (
          opportunities.map((f) => (
            <View key={f.id} style={styles.row} wrap={false}>
              <Text style={styles.bullet}>—</Text>
              <Text style={{ flex: 1, marginBottom: 6 }}>{f.title ?? f.observation}</Text>
            </View>
          ))
        )}
        <Footer page="Underused / missed opportunities" />
      </Page>

      {/* 08 The 3 moves */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="08" title="The 3 moves we would make first" />
        {data.moves.length === 0 ? (
          <EmptyNote>The strategic plan has not been approved for this report yet.</EmptyNote>
        ) : (
          data.moves.map((m) => (
            <View key={m.id} style={styles.card} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>
                Move {m.rank} — {m.title}
              </Text>
              <Text style={styles.fieldLabel}>What we found</Text>
              <Text style={styles.fieldValue}>{m.what_we_found}</Text>
              <Text style={styles.fieldLabel}>What we would change</Text>
              <Text style={styles.fieldValue}>{m.what_we_would_change}</Text>
              <Text style={styles.fieldLabel}>Why this comes first</Text>
              <Text style={styles.fieldValue}>{m.why_first}</Text>
              {m.enables_next ? <Text style={styles.fieldLabel}>What it enables next</Text> : null}
              {m.enables_next ? <Text style={styles.fieldValue}>{m.enables_next}</Text> : null}
              {m.success_indicator ? (
                <Text style={styles.fieldLabel}>Success indicator</Text>
              ) : null}
              {m.success_indicator ? (
                <Text style={styles.fieldValue}>{m.success_indicator}</Text>
              ) : null}
            </View>
          ))
        )}
        <Footer page="The 3 moves we would make first" />
      </Page>

      {/* 09 30-day roadmap */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="09" title="30-day action roadmap" />
        {data.roadmap.length === 0 ? (
          <EmptyNote>The strategic plan has not been approved for this report yet.</EmptyNote>
        ) : (
          [...roadmapByWeek.entries()].map(([week, items]) => (
            <View key={week} style={{ marginBottom: 14 }} wrap={false}>
              <Text style={styles.h2}>Week {week}</Text>
              {items.map((item) => (
                <View key={item.id} style={{ marginBottom: 6 }}>
                  <View style={styles.row}>
                    <Text style={styles.bullet}>—</Text>
                    <Text style={{ flex: 1 }}>{item.action}</Text>
                  </View>
                  {item.completion_indicator ? (
                    <Text style={[styles.small, styles.muted, { marginLeft: 14 }]}>
                      Done when: {item.completion_indicator}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))
        )}
        <Footer page="30-day action roadmap" />
      </Page>

      {/* 10 What we could not verify */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="10" title="What we could not verify" />
        {unverifiable.length === 0 ? (
          <EmptyNote>
            Everything examined in this audit could be verified from the evidence gathered.
          </EmptyNote>
        ) : (
          unverifiable.map((f) => (
            <View key={f.id} style={styles.row} wrap={false}>
              <Text style={styles.bullet}>—</Text>
              <Text style={{ flex: 1, marginBottom: 6 }}>{f.title ?? f.observation}</Text>
            </View>
          ))
        )}
        <Footer page="What we could not verify" />
      </Page>

      {/* 11 Methodology & sources */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="11" title="Methodology & sources" />
        <EmptyNote>
          Every significant finding in this report is traceable to one of the sources below.
        </EmptyNote>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellHead}>Source</Text>
            <Text style={styles.tableCellHead}>Type</Text>
            <Text style={styles.tableCellHead}>Retrieved</Text>
            <Text style={styles.tableCellHead}>Status</Text>
          </View>
          {data.sourcesReviewed.map((s, i) => (
            <View
              key={i}
              style={i === data.sourcesReviewed.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={styles.tableCell}>{s.name}</Text>
              <Text style={styles.tableCell}>{s.type}</Text>
              <Text style={styles.tableCell}>
                {s.retrievedAt ? new Date(s.retrievedAt).toLocaleDateString() : "—"}
              </Text>
              <Text style={styles.tableCell}>{s.verificationStatus}</Text>
            </View>
          ))}
        </View>
        <Footer page="Methodology & sources" />
      </Page>

      {/* 12 Next step */}
      <Page size="A4" style={styles.page}>
        <SectionHeading number="12" title="Next step" />
        <Text style={styles.p}>
          If you would like {BRAND.name} to implement any of the priority recommendations above, we
          can turn these findings into an execution plan covering scope, sequence and deliverables.
        </Text>
        <Text style={[styles.p, styles.muted]}>
          {BRAND.email} · {BRAND.siteUrl.replace(/^https?:\/\//, "")}
        </Text>
        <Footer page="Next step" />
      </Page>
    </Document>
  );
}

// Server-only module (rendered inside API routes) — fast refresh doesn't apply.
// eslint-disable-next-line react-refresh/only-export-components
export async function renderAuditPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<AuditPdfDocument data={data} />);
}
