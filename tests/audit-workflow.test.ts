import { beforeAll, afterAll, test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  normalizeResearch,
  SECTION_KEYS,
  validateResearch,
  promptFor,
  DEFAULT_PROMPT,
  reviewIssues,
  type WorkflowState,
} from "../src/lib/author-audit/workflow";
const id = "00000000-0000-4000-8000-000000000001";
const raw = {
  ...Object.fromEntries(SECTION_KEYS.map((k) => [k, null])),
  audit_meta: {
    audit_id: id,
    author_name: "Test Author",
    book_title: "Test Book",
    research_date: "2026-10-02",
  },
  audit_findings: [
    {
      title: "Missing newsletter link",
      category: "website_audit",
      what_we_found: "The inspected book page has no newsletter link.",
      source_urls: ["https://example.com/book"],
      recommendation: "Add a link.",
    },
  ],
  goodreads_listopia_audit: [],
  screenshot_queue: [],
  manual_review_queue: [],
  priority_action_plan: [],
};
const expected = { id, author: "Test Author", book: "Test Book" };
test("research validation checks identity, syntax, duplicate findings, URLs, sections and scripts", () => {
  expect(validateResearch(JSON.stringify(raw), expected).valid).toBe(true);
  expect(validateResearch("{", expected).valid).toBe(false);
  expect(validateResearch(JSON.stringify(raw), { ...expected, author: "Other" }).valid).toBe(false);
  expect(
    validateResearch(
      JSON.stringify({ ...raw, audit_findings: [raw.audit_findings[0], raw.audit_findings[0]] }),
      expected,
    ).valid,
  ).toBe(false);
  expect(
    validateResearch(
      JSON.stringify({
        ...raw,
        audit_findings: [{ ...raw.audit_findings[0], source_urls: ["javascript:alert(1)"] }],
      }),
      expected,
    ).valid,
  ).toBe(false);
  const missing = { ...raw };
  delete missing.executive_summary;
  expect(validateResearch(JSON.stringify(missing), expected).valid).toBe(false);
  expect(
    validateResearch(
      JSON.stringify({ ...raw, author_profile: "<script>alert(1)</script>" }),
      expected,
    ).valid,
  ).toBe(false);
  expect(
    validateResearch(
      JSON.stringify({
        ...raw,
        audit_findings: [{ ...raw.audit_findings[0], review_status: "approved" }],
      }),
      expected,
    ).valid,
  ).toBe(false);
});
test("reusable prompt contains identity, date, context and the full required output shape", () => {
  const prompt = promptFor(DEFAULT_PROMPT, {
    id,
    authors: { name: "Test Author" },
    books: { title: "Test Book" },
    input_snapshot: { notes: "Research this" },
  } as WorkflowState["audit"]);
  expect(prompt).toContain(id);
  expect(prompt).toContain("Research this");
  expect(prompt).toContain("services_not_to_pitch");
  expect(prompt).not.toContain("{{");
});
test("review gate rejects unreviewed findings, incomplete screenshots, sections and actions", () => {
  const state = {
    findings: [
      {
        id: "f",
        title: "Finding",
        category: "website_audit",
        hidden: false,
        review_status: "approved",
        manual_status: "pending",
        recommendation: "Fix",
        source_urls: [],
        evidence_text: "",
      },
    ],
    sections: [
      {
        key: "website_audit",
        title: "Website",
        enabled: true,
        review_status: "pending",
        content: "",
      },
    ],
    assets: [],
    tasks: [{ kind: "screenshot", title: "Capture", required: true, status: "approved", id: "t" }],
    actions: [{ title: "Action", review_status: "pending" }],
    listopia: [],
  } as unknown as WorkflowState;
  expect(reviewIssues(state).length).toBeGreaterThanOrEqual(4);
});
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(bucket_id text); CREATE TABLE expert_profiles(id uuid primary key);",
  );
  for (const name of [
    "20260916110000_author_visibility_audits.sql",
    "20260917090000_author_audit_v2.sql",
    "20260917150000_private_client_audits.sql",
    "20261002230000_audit_research_workflow.sql",
  ])
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"),
    );
  await db.exec(
    `INSERT INTO authors(id,name,normalized_name) VALUES('${id}','Test Author','test author'); INSERT INTO books(id,author_id,title,normalized_title) VALUES('${id}','${id}','Test Book','test book'); INSERT INTO author_audits(id,author_id,book_id,workflow_version,status) VALUES('${id}','${id}','${id}',1,'research_pending');`,
  );
}, 20000);
afterAll(() => db.close());
test("imports are atomic, immutable and never approved or client-visible", async () => {
  const parsed = validateResearch(JSON.stringify(raw), expected);
  if (!parsed.valid) throw new Error(parsed.errors.join());
  await db.query("SELECT audit_import_research($1,$2,$3,$4,$5)", [
    id,
    "admin",
    "Claude",
    JSON.stringify(raw),
    JSON.stringify(parsed.data),
  ]);
  expect(
    (await db.query("SELECT review_status,client_visible,origin FROM audit_findings")).rows[0],
  ).toEqual({ review_status: "ai_research", client_visible: false, origin: "research_import" });
  await expect(db.exec("UPDATE audit_research_imports SET raw_text='changed'")).rejects.toThrow(
    "immutable",
  );
  await expect(
    db.query("SELECT audit_import_research($1,$2,$3,$4,$5)", [
      id,
      "admin",
      "Claude",
      JSON.stringify(raw),
      JSON.stringify(parsed.data),
    ]),
  ).rejects.toThrow();
  expect((await db.query("SELECT count(*)::int n FROM audit_research_imports")).rows[0]).toEqual({
    n: 1,
  });
});
test("publication requires QA and current revision, and preserves old snapshots", async () => {
  const revision = async () =>
    (
      await db.query<{ workflow_revision: number }>(
        "SELECT workflow_revision FROM author_audits WHERE id=$1",
        [id],
      )
    ).rows[0]!.workflow_revision;
  const rev = await revision();
  const snapshot = { workflowVersion: 1, revision: rev, reviewIssues: [], findings: [] };
  const result = await db.query<{ id: string }>(
    "SELECT audit_create_reviewed_version($1,$2,$3,'admin','Test') id",
    [id, rev, JSON.stringify(snapshot)],
  );
  const v = result.rows[0]!.id;
  await expect(
    db.query("SELECT audit_publish_reviewed($1,$2,'test/book','hash','admin','')", [id, v]),
  ).rejects.toThrow();
  await db.query("UPDATE audit_client_versions SET qa_confirmed=true WHERE id=$1", [v]);
  await db.query("SELECT audit_publish_reviewed($1,$2,'test/book','hash','admin','')", [id, v]);
  await db.exec("UPDATE audit_findings SET observation='Edited draft'");
  expect(
    (await db.query("SELECT snapshot FROM audit_client_versions WHERE id=$1", [v])).rows[0],
  ).toEqual({ snapshot });
  await expect(
    db.query("UPDATE audit_client_versions SET snapshot='{}' WHERE id=$1", [v]),
  ).rejects.toThrow("immutable");
  const r2 = await revision();
  const draft = await db.query<{ id: string }>(
    "SELECT audit_create_reviewed_version($1,$2,$3,'admin','Revision') id",
    [id, r2, JSON.stringify({ ...snapshot, revision: r2 })],
  );
  await db.query("UPDATE audit_client_versions SET qa_confirmed=true WHERE id=$1", [
    draft.rows[0]!.id,
  ]);
  await db.exec("UPDATE audit_findings SET observation='Changed again'");
  await expect(
    db.query("SELECT audit_publish_reviewed($1,$2,'test/book',null,'admin','')", [
      id,
      draft.rows[0]!.id,
    ]),
  ).rejects.toThrow();
  expect(
    (await db.query("SELECT version_id FROM audit_client_access WHERE audit_id=$1", [id])).rows[0],
  ).toEqual({ version_id: v });
});
test("workflow records and publish functions are inaccessible to anonymous clients", async () => {
  await db.exec("SET ROLE anon");
  await expect(db.exec("SELECT * FROM audit_research_imports")).rejects.toThrow();
  await expect(
    db.query("SELECT audit_publish_reviewed($1,$1,'test/book','hash','admin','')", [id]),
  ).rejects.toThrow();
  await db.exec("RESET ROLE");
});

test("normalizes common AI phrasings before validation", () => {
  const out = normalizeResearch({
    audit_findings: [
      { title: "a", priority: "high_priority" },
      { title: "b", priority: "low_priority" },
      { title: "c", priority: "Medium" },
    ],
    goodreads_listopia_audit: [{ list_name: "Best debuts", list_url: null }],
    priority_action_plan: [
      { order: 2, action: "Second", reason: "Because two" },
      { order: 1, action: "First", reason: "Because one", timeframe: "30 days" },
    ],
    manual_review_queue: [{ item: "Check Amazon", reason: "Region-locked" }],
  });
  expect(out.audit_findings.map((f: { priority: string }) => f.priority)).toEqual([
    "high_impact",
    "optional",
    "medium_priority",
  ]);
  expect(out.goodreads_listopia_audit[0].list_url).toBe("");
  expect(out.priority_action_plan).toEqual([
    { title: "First", description: "Because one", horizon: "next_30_days" },
    { title: "Second", description: "Because two" },
  ]);
  expect(out.manual_review_queue).toEqual([
    { title: "Check Amazon", instructions: "Region-locked" },
  ]);
});
