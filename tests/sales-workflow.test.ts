import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { leadSchema } from "../src/lib/sales";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create table payment_invoices(id uuid primary key default gen_random_uuid());
 create table project_inquiries(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),name text,email text,help_with text[],message text);
 create table author_audit_leads(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),author_name text,email text,book_title text);
 create table scout_authors(id uuid primary key default gen_random_uuid(),name text,contact_email text);
 create table scout_prospects(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),scout_author_id uuid,status text,do_not_contact boolean);
 insert into project_inquiries(name,email,help_with) values ('Existing author','test@example.com',array['Editing']);`);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/20260930100000_sales_workflow.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
test("backfills existing inquiries and captures new visibility requests", async () => {
  expect((await db.query("select * from sales_leads")).rows).toHaveLength(1);
  await db.exec(
    "insert into author_audit_leads(author_name,email,book_title) values ('Author','test@example.com','New book')",
  );
  const rows = (
    await db.query<{ source_kind: string; check_completed_at: string | null }>(
      "select * from sales_leads",
    )
  ).rows;
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.source_kind === "visibility_check")?.check_completed_at).toBeNull();
});
test("stage history survives progression for qualification and proposal metrics", async () => {
  await db.exec(
    "update sales_leads set stage='qualified' where source_kind='inquiry'; update sales_leads set stage='proposal' where source_kind='inquiry'; update sales_leads set stage='won',project_status='in_progress' where source_kind='inquiry';",
  );
  const events = (
    await db.query<{ detail: string }>(
      "select detail from sales_events where event='stage_changed'",
    )
  ).rows.map((row) => row.detail);
  expect(events).toEqual(["qualified", "proposal", "won"]);
  await expect(db.exec("update sales_leads set stage='fake'")).rejects.toThrow();
});
test("Scout exclusion closes follow-ups and cannot create duplicate leads on updates", async () => {
  await db.exec(
    "insert into scout_authors(name) values ('Prospect'); insert into scout_prospects(scout_author_id,status,do_not_contact) select id,'new',false from scout_authors; update scout_prospects set status='qualified';",
  );
  expect((await db.query("select * from sales_leads where source_kind='scout'")).rows).toHaveLength(
    1,
  );
  await db.exec(
    "update sales_leads set next_follow_up='2026-10-01' where source_kind='scout'; update scout_prospects set do_not_contact=true;",
  );
  expect(
    (await db.query("select stage,next_follow_up from sales_leads where source_kind='scout'"))
      .rows[0],
  ).toEqual({ stage: "lost", next_follow_up: null });
});
test("public roles cannot read or mutate the sales pipeline or event history", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const table of ["sales_leads", "sales_events"])
      await expect(db.query(`select * from ${table}`)).rejects.toThrow();
    await expect(db.exec("update sales_leads set stage='won'")).rejects.toThrow();
    await db.exec("reset role");
  }
});
test("rejects unsafe report links and invalid dates before persistence", () => {
  const values = {
    name: "Author",
    email: "",
    assigned_to: "",
    stage: "needs_review",
    check_completed_at: null,
    last_contact: null,
    next_follow_up: null,
    report_url: "",
    proposal_url: "",
    invoice_id: null,
    agreed_service: "",
    project_status: "not_started",
    notes: "",
  };
  expect(leadSchema.safeParse(values).success).toBe(true);
  expect(leadSchema.safeParse({ ...values, report_url: "javascript:alert(1)" }).success).toBe(
    false,
  );
  expect(leadSchema.safeParse({ ...values, next_follow_up: "tomorrow" }).success).toBe(false);
});

test("records an initial proposal stage when an existing opportunity is added manually", async () => {
  const row = (
    await db.query<{ id: string }>(
      "insert into sales_leads(source_kind,name,stage) values ('manual','Existing opportunity','proposal') returning id",
    )
  ).rows[0]!;
  const events = (
    await db.query<{ detail: string }>(
      "select detail from sales_events where lead_id=$1 and event='stage_changed'",
      [row.id],
    )
  ).rows;
  expect(events).toEqual([{ detail: "proposal" }]);
});
