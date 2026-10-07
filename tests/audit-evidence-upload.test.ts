import { expect, test } from "bun:test";
import { evidenceUploadTarget } from "../src/lib/author-audit/evidence-upload";
import type { WorkflowState } from "../src/lib/author-audit/workflow";

const state = {
  tasks: [{ id: "task", category: "website_audit" }],
  findings: [{ id: "finding", category: "amazon_audit" }],
  listopia: [
    {
      id: "list",
      list_name: "Historical fiction",
      list_url: "https://www.goodreads.com/list/show/123",
    },
  ],
} as Pick<WorkflowState, "tasks" | "findings" | "listopia">;
const refs = { taskId: null, findingId: null, listopiaId: null };

test("ranking proof is attached to its list with source and caption, without inventing capture date or rank", () => {
  expect(evidenceUploadTarget(state, { ...refs, listopiaId: "list" })).toEqual({
    task_id: null,
    finding_id: null,
    listopia_id: "list",
    category: "goodreads_listopia_audit",
    source: "https://www.goodreads.com/list/show/123",
    caption: "Ranking screenshot — Historical fiction",
  });
});

test("uploads cannot link to another audit's list, finding or request", () => {
  for (const key of ["listopiaId", "findingId", "taskId"] as const) {
    expect(() => evidenceUploadTarget(state, { ...refs, [key]: "outside-this-audit" })).toThrow();
  }
});

test("general, finding and requested evidence uploads still resolve their categories", () => {
  expect(evidenceUploadTarget(state, refs).category).toBe("general");
  expect(evidenceUploadTarget(state, { ...refs, findingId: "finding" }).category).toBe(
    "amazon_audit",
  );
  expect(evidenceUploadTarget(state, { ...refs, taskId: "task" }).category).toBe("website_audit");
});
