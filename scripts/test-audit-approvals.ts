// Opt-in integration check: creates isolated fixtures, never publishes, deletes its fixtures.
import { clientDb } from "../src/lib/author-audit/client-access.server";
import { workflowPost } from "../src/lib/author-audit/workflow.server";
import { sessionCookie } from "../src/lib/admin-auth.server";
if (process.env.RUN_AUDIT_LIVE_TEST !== "1") throw new Error("Set RUN_AUDIT_LIVE_TEST=1");
const db = clientDb();
const tag = `approval-test-${crypto.randomUUID()}`;
let author: string | undefined, audit: string | undefined;
async function insert(table: string, values: object) {
  const r = await db.from(table).insert(values).select("id").single();
  if (r.error) throw r.error;
  return r.data!.id as string;
}
try {
  author = await insert("authors", { name: tag, normalized_name: tag });
  const book = await insert("books", { author_id: author, title: tag, normalized_title: tag });
  audit = await insert("author_audits", { author_id: author, book_id: book, workflow_version: 1 });
  const fixtures = [
    ["section", "audit_sections", { key: "book_identity", title: "Identity" }],
    [
      "finding",
      "audit_findings",
      {
        section: "book_identity",
        category: "book_identity",
        title: "Finding",
        observation: "Saved finding",
        status: "healthy",
        priority: "optional",
      },
    ],
    ["listopia", "audit_listopia", { list_name: "List", list_url: "https://example.com/list" }],
    ["action", "audit_action_plan", { title: "Action" }],
    [
      "asset",
      "audit_evidence_assets",
      {
        storage_url: "",
        caption: "Proof",
        proves: "Observed position",
        source: "https://example.com/list",
        asset_date: "2026-10-07",
      },
    ],
  ] as const;
  const cookie = (await sessionCookie()).split(";")[0]!;
  for (const [entity, table, values] of fixtures) {
    const id = await insert(table, { ...values, audit_id: audit });
    for (const status of ["approved", "rejected"] as const) {
      const response = await workflowPost(
        new Request("http://localhost/api/audit", {
          method: "POST",
          headers: { origin: "http://localhost", cookie, "content-type": "application/json" },
          body: JSON.stringify({ action: "review", entity, id, status }),
        }),
        audit,
      );
      if (!response.ok) throw new Error(`${entity}: ${await response.text()}`);
      const result = await db.from(table).select("review_status").eq("id", id).single();
      if (result.data?.review_status !== status)
        throw new Error(`${entity}: status did not persist`);
    }
    console.log(`PASS ${entity}: approve and reject persisted`);
  }
} finally {
  if (audit) {
    const r = await db.from("author_audits").delete().eq("id", audit);
    if (r.error) {
      console.error("Fixture cleanup failed", r.error);
      process.exitCode = 1;
    }
  }
  if (author) {
    const r = await db.from("authors").delete().eq("id", author);
    if (r.error) {
      console.error("Fixture cleanup failed", r.error);
      process.exitCode = 1;
    }
  }
}
