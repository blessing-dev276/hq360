import { beforeAll, afterAll, test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { SECTION_KEYS, validateResearch } from "../src/lib/author-audit/workflow";
const db = new PGlite();
const id = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(bucket_id text); CREATE TABLE expert_profiles(id uuid primary key);",
  );
  for (const name of [
    "20260916110000_author_visibility_audits.sql",
    "20260917090000_author_audit_v2.sql",
    "20260917150000_private_client_audits.sql",
    "20261002230000_audit_research_workflow.sql",
    "20261008170000_admin_perplexity_credentials.sql",
    "20261008180000_audit_commercial.sql",
  ])
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"),
    );
  await db.exec(
    `INSERT INTO authors(id,name,normalized_name) VALUES('${id}','Author','author'); INSERT INTO books(id,author_id,title,normalized_title) VALUES('${id}','${id}','Book','book'); INSERT INTO author_audits(id,author_id,book_id,workflow_version,status) VALUES('${id}','${id}','${id}',1,'research_pending');`,
  );
}, 20000);
afterAll(() => db.close());
test("extended import stores evidence annotations without changing original citations", async () => {
  const raw = {
    ...Object.fromEntries(SECTION_KEYS.map((k) => [k, null])),
    audit_meta: {
      audit_id: id,
      author_name: "Author",
      book_title: "Book",
      research_date: "2026-10-08",
    },
    audit_findings: [
      {
        title: "Award",
        category: "media_and_authority",
        classification: "verified_fact",
        what_we_found: "Award winner",
        evidence: "Prize winner retrieved 2026-10-08",
        source_urls: ["https://example.com/prize"],
        recommendation: "Assess a media angle",
        commercial: { finding_type: "strength", retrieval_dates: ["2026-10-08"] },
      },
    ],
    goodreads_listopia_audit: [],
    screenshot_queue: [],
    manual_review_queue: [],
    priority_action_plan: [],
  };
  const parsed = validateResearch(JSON.stringify(raw), { id, author: "Author", book: "Book" });
  if (!parsed.valid) throw new Error(parsed.errors.join("; "));
  await db.query("SELECT audit_import_research($1,'admin','ChatGPT',$2,$3)", [
    id,
    JSON.stringify(raw),
    JSON.stringify(parsed.data),
  ]);
  const row = (
    await db.query<{ commercial: { finding_type: string }; source_urls: string[] }>(
      "SELECT commercial,source_urls FROM audit_findings",
    )
  ).rows[0]!;
  expect(row.commercial.finding_type).toBe("strength");
  expect(row.source_urls).toEqual(["https://example.com/prize"]);
});
test("mapping transaction enforces audit ownership and preserves old mappings on failure", async () => {
  const finding = (await db.query<{ id: string }>("SELECT id FROM audit_findings LIMIT 1"))
    .rows[0]!;
  const revision = (
    await db.query<{ workflow_revision: number }>("SELECT workflow_revision FROM author_audits")
  ).rows[0]!.workflow_revision;
  const mapping = {
    finding_id: finding.id,
    service_id: "podcast-press",
    supporting_evidence_ids: ["https://example.com/prize"],
  };
  await db.query("SELECT audit_save_service_matches($1,$2,$3)", [
    id,
    revision,
    JSON.stringify([mapping]),
  ]);
  await expect(
    db.query("SELECT audit_save_service_matches($1,$2,$3)", [
      id,
      revision,
      JSON.stringify([{ ...mapping, finding_id: "00000000-0000-4000-8000-000000000099" }]),
    ]),
  ).rejects.toThrow("outside audit");
  expect((await db.query("SELECT * FROM audit_service_matches")).rows).toHaveLength(1);
  await expect(db.query("SELECT audit_save_service_matches($1,9999,'[]')", [id])).rejects.toThrow(
    "Audit changed",
  );
});
test("database blocks unapproved shared proposals and browser access to private tables", async () => {
  await expect(
    db.query(
      "INSERT INTO audit_proposals(audit_id,draft,audit_revision,config_revision,status) VALUES($1,'{}',1,'default','shared')",
      [id],
    ),
  ).rejects.toThrow();
  for (const table of [
    "audit_commercial_config",
    "audit_service_matches",
    "audit_proposals",
    "admin_perplexity_credentials",
  ]) {
    const result = await db.query<{ allowed: boolean }>(
      "SELECT has_table_privilege('anon',$1,'SELECT') AS allowed",
      [table],
    );
    expect(result.rows[0]!.allowed).toBe(false);
  }
});
