import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ResearchAuditReport } from "../src/components/site/ResearchAuditReport";
import { sectionNarrative } from "../src/lib/author-audit/report-presentation";
import type { WorkflowSnapshot } from "../src/lib/author-audit/workflow.server";

test("section presentation removes template duplication and retains unique sources and prose", () => {
  expect(
    sectionNarrative(
      "What We Found: Hq360 found a metadata mismatch.\n\nEvidence: Archived observation.\n\nSource Urls: https://example.com/book\n\nhttps://example.com/author\n\nA separate useful paragraph.",
    ),
  ).toEqual({
    text: "HQ360 found a metadata mismatch.\n\nA separate useful paragraph.",
    sources: ["https://example.com/book", "https://example.com/author"],
  });
});

test("client report keeps actions and evidence, hides duplicate prose and missing metrics, preserves zero votes", () => {
  const report = {
    author: { name: "Test Author" },
    book: { title: "Test Book" },
    preparedDate: "2026-10-05",
    sections: [
      {
        key: "book_identity",
        title: "Book identity",
        content:
          "What We Found: A useful finding.\n\nEvidence: Repeated evidence.\n\nSource Urls: https://example.com/book",
        sort_order: 0,
      },
    ],
    findings: [
      {
        id: "finding",
        category: "book_identity",
        title: "Metadata issue",
        priority: "immediate",
        classification: "direct_observation",
        what_we_checked: "Book page",
        what_we_found: "Edition mismatch",
        why_it_matters: "Reader confusion",
        interpretation: "Duplicate interpretation",
        evidence: "Original evidence",
        recommendation: "Correct edition",
        implementation_steps: [],
        source_urls: ["https://example.com/book"],
      },
    ],
    listopia: [
      {
        id: "list",
        list_name: "Relevant list",
        list_url: "",
        position: null,
        page: null,
        votes: 0,
        competition: "high",
        books_above: [],
        books_below: [],
        why_position: "Relevant theme",
        how_to_improve: "Verify the edition",
      },
    ],
    actions: [
      {
        id: "action",
        title: "Correct metadata",
        description: "Resolve edition mismatch",
        horizon: "do_first",
        service: "Metadata review",
      },
    ],
    assets: [],
    metrics: { platforms: 1, sources: 1, findings: 1, screenshots: 0, actions: 1 },
    ctaEnabled: true,
  } as unknown as WorkflowSnapshot;
  const html = renderToStaticMarkup(<ResearchAuditReport report={report} />);
  for (const absent of [
    "Audit snapshot",
    "What We Found:",
    "Repeated evidence",
    "Duplicate interpretation",
    "Current position",
    ">Page<",
    "This is our interpretation;",
  ])
    expect(html).not.toContain(absent);
  for (const kept of [
    "Original evidence",
    "Correct metadata",
    "How HQ360 can help",
    "Votes",
    ">0<",
    "List relevance",
    "Methodology",
  ])
    expect(html).toContain(kept);
  expect(html.match(/href="https:\/\/example.com\/book"/g)).toHaveLength(1);
  expect(report.findings[0].interpretation).toBe("Duplicate interpretation");
});
