import { expect, test } from "bun:test";
import { approvalPatch } from "../src/lib/author-audit/approval";
import { auditEditSchemas } from "../src/lib/author-audit/workflow.server";

test("approval only updates status and visibility, preserving saved content and hidden findings", () => {
  expect(approvalPatch("finding", { title: "Saved title", hidden: true }, "approved")).toEqual({
    review_status: "approved",
    client_visible: false,
  });
  for (const entity of ["section", "listopia", "action"] as const)
    expect(approvalPatch(entity, { content: null }, "approved")).toEqual({
      review_status: "approved",
    });
});
test("incomplete screenshots can be rejected and give actionable approval errors", () => {
  expect(approvalPatch("asset", { caption: null, asset_date: null }, "rejected")).toEqual({
    review_status: "rejected",
    client_visible: false,
  });
  expect(() => approvalPatch("asset", { caption: null }, "approved")).toThrow(
    "Edit this screenshot and add caption, what it proves, source URL, capture date",
  );
  expect(
    approvalPatch(
      "asset",
      {
        caption: "Ranking",
        proves: "Position",
        source: "https://example.com",
        asset_date: "2026-10-07",
      },
      "approved",
    ).client_visible,
  ).toBe(true);
});
test("screenshot editor accepts nullable database fields so incomplete uploads can be fixed", () => {
  const parsed = auditEditSchemas.asset.parse({
    finding_id: null,
    task_id: null,
    category: "general",
    caption: null,
    proves: "",
    source: null,
    asset_date: null,
    review_status: "pending",
    display_kind: "current",
    sort_order: 0,
  });
  expect(parsed.caption).toBe("");
  expect(parsed.asset_date).toBe("");
});
