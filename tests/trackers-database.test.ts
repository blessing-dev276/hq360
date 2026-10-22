import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const migration = async (name: string) =>
  db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));

// A real bcrypt hash shape (60 chars) of a throwaway value, for constraint checks.
const HASH = "$2b$04$abcdefghijklmnopqrstuuJ4wq0ZxW3cB5nR0qWm6eUq8bX7aQyKm";
let expert = "";

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role;");
  // Minimal stand-ins for the existing tables the new migrations reference.
  await db.exec(`
    create table public.expert_profiles (id uuid primary key default gen_random_uuid(), email text, full_name text);
    create table public.expert_portfolio_items (
      id uuid primary key default gen_random_uuid(),
      expert_id uuid not null references public.expert_profiles(id) on delete cascade,
      title text not null, description text, image_url text, external_link text,
      status text not null default 'pending' constraint expert_portfolio_items_status_check check (status in ('pending','approved','rejected')),
      reviewed_at timestamptz, reviewed_by text, sort_order integer not null default 0,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  `);
  for (const name of [
    "20261020090000_client_trackers.sql",
    "20261020090100_academy_daily_lessons_seed.sql",
    "20261020100000_expert_ai_keys.sql",
    "20261020110000_tracker_auto_portfolio.sql",
  ])
    await migration(name);
  expert = (await db.query<{ id: string }>("insert into expert_profiles(email) values ('e@example.com') returning id")).rows[0]!.id;
}, 30000);
afterAll(async () => {
  await db.close();
});

const newTracker = async (slug: string) =>
  (
    await db.query<{ id: string }>(
      "insert into client_trackers(expert_id, client_name, slug, passcode_hash) values ($1, 'Client', $2, $3) returning id",
      [expert, slug, HASH],
    )
  ).rows[0]!.id;

describe("phase 1: tracking pages", () => {
  test("a plain text passcode can never be stored", async () => {
    await expect(
      db.query("insert into client_trackers(expert_id, client_name, slug, passcode_hash) values ($1,'C','plain-abcd','HARBOR5521')", [expert]),
    ).rejects.toThrow();
    expect(await newTracker("hashed-ab12")).toBeTruthy();
  });

  test("links need the random 4 character ending and are unique", async () => {
    await expect(newTracker("no-random")).rejects.toThrow();
    await newTracker("unique-zz99");
    await expect(newTracker("unique-zz99")).rejects.toThrow();
  });

  test("a page cannot go live without a passcode and a published snapshot", async () => {
    const id = await newTracker("golive-1a2b");
    await expect(db.query("update client_trackers set status='live' where id=$1", [id])).rejects.toThrow();
    await db.query("update client_trackers set status='live', published_snapshot='{}'::jsonb where id=$1", [id]);
    await expect(
      db.query("update client_trackers set passcode_hash=null where id=$1", [id]),
    ).rejects.toThrow();
  });

  test("five wrong attempts lock the page for that visitor for 15 minutes", async () => {
    const id = await newTracker("lock-aaaa");
    const visitor = "a".repeat(64);
    const attempt = async (ok: boolean) =>
      (await db.query<{ t: string | null }>("select tracker_record_attempt($1,$2,$3) as t", [id, visitor, ok])).rows[0]!.t;
    for (let i = 0; i < 4; i += 1) expect(await attempt(false)).toBeNull();
    const lockedUntil = await attempt(false);
    expect(lockedUntil).not.toBeNull();
    const minutes = (new Date(lockedUntil!).getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15.1);
    const lock = (await db.query<{ t: string | null }>("select tracker_lock_until($1,$2) as t", [id, visitor])).rows[0]!.t;
    expect(lock).not.toBeNull();
    // Another visitor is not affected.
    expect((await db.query<{ t: string | null }>("select tracker_lock_until($1,$2) as t", [id, "b".repeat(64)])).rows[0]!.t).toBeNull();
    // After the lock ends, the count starts again from one.
    await db.query("update tracker_unlock_attempts set locked_until = now() - interval '1 second' where tracker_id=$1", [id]);
    expect((await db.query<{ t: string | null }>("select tracker_lock_until($1,$2) as t", [id, visitor])).rows[0]!.t).toBeNull();
    expect(await attempt(false)).toBeNull();
    const row = (await db.query<{ failures: number }>("select failures from tracker_unlock_attempts where tracker_id=$1", [id])).rows[0]!;
    expect(row.failures).toBe(1);
    expect(await attempt(true)).toBeNull();
    expect((await db.query("select 1 from tracker_unlock_attempts where tracker_id=$1", [id])).rows).toHaveLength(0);
  });

  test("view events hold a hash, never a raw IP address", async () => {
    const id = await newTracker("views-abcd");
    await expect(
      db.query("insert into tracker_view_events(tracker_id, event, visitor_hash) values ($1,'open','203.0.113.9')", [id]),
    ).rejects.toThrow();
    await db.query("insert into tracker_view_events(tracker_id, event, visitor_hash, country) values ($1,'open',$2,'GB')", [id, "c".repeat(64)]);
  });

  test("browsers can never read trackers, events, keys or drafts directly", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of [
        "client_trackers",
        "tracker_items",
        "tracker_files",
        "tracker_view_events",
        "tracker_unlock_attempts",
        "expert_ai_credentials",
        "expert_ai_usage",
        "tracker_ai_drafts",
        "academy_content",
      ]) {
        await db.exec(`set role ${role}`);
        await expect(db.query(`select * from ${table}`)).rejects.toThrow();
        await db.exec("reset role");
      }
    }
  });
});

describe("phase 1: academy content records", () => {
  test("every save keeps a version with the editor and date", async () => {
    const id = (
      await db.query<{ id: string }>(
        "insert into academy_content(kind, slug, number, title, body, updated_by) values ('chapter','ch-26-leads',26,'Finding leads','v1','Trainer A') returning id",
      )
    ).rows[0]!.id;
    await db.query("update academy_content set body='v2', updated_by='Trainer B', published=true where id=$1", [id]);
    const versions = (
      await db.query<{ version: number; editor: string; snapshot: { body: string } }>(
        "select version, editor, snapshot from academy_content_versions where content_id=$1 order by version",
        [id],
      )
    ).rows;
    expect(versions.map((v) => [v.version, v.editor, v.snapshot.body])).toEqual([
      [1, "Trainer A", "v1"],
      [2, "Trainer B", "v2"],
    ]);
    const row = (await db.query<{ published_at: string | null }>("select published_at from academy_content where id=$1", [id])).rows[0]!;
    expect(row.published_at).not.toBeNull(); // starts the 7 day New badge
  });

  test("diagrams are stored as SVG", async () => {
    await expect(db.query("insert into academy_content(kind, slug, title) values ('diagram','funnel','Lead funnel')")).rejects.toThrow();
    await expect(
      db.query("insert into academy_content(kind, slug, title, svg) values ('diagram','funnel','Lead funnel','<png>')"),
    ).rejects.toThrow();
    await db.query(
      `insert into academy_content(kind, slug, title, svg) values ('diagram','funnel','Lead funnel','<svg xmlns="http://www.w3.org/2000/svg"></svg>')`,
    );
  });

  test("the daily lessons from the playbook are seeded as published records", async () => {
    const rows = (await db.query<{ n: number }>("select count(*)::int as n from academy_content where kind='daily_lesson' and published")).rows[0]!;
    expect(rows.n).toBeGreaterThanOrEqual(10);
  });
});

describe("phase 2: AI drafts", () => {
  test("a draft can only be marked approved together with the person and time", async () => {
    const id = await newTracker("drafts-abcd");
    const draft = (
      await db.query<{ id: string }>(
        `insert into tracker_ai_drafts(tracker_id, action, input, output) values ($1,'draft_update','notes','{"log_entry":"x"}') returning id`,
        [id],
      )
    ).rows[0]!.id;
    await expect(db.query("update tracker_ai_drafts set status='approved' where id=$1", [draft])).rejects.toThrow();
    await db.query("update tracker_ai_drafts set status='approved', approved_by=$2, approved_at=now() where id=$1", [draft, expert]);
  });

  test("keys are stored only in the encrypted v1 format", async () => {
    await expect(
      db.query("insert into expert_ai_credentials(expert_id, provider, encrypted_key, last_four) values ($1,'openai','sk-plain-key-1234','1234')", [expert]),
    ).rejects.toThrow();
  });
});

describe("phase 3: auto portfolio needs consent", () => {
  async function setup(slug: string) {
    const tracker = await newTracker(slug);
    const item = (
      await db.query<{ id: string }>(
        "insert into tracker_items(tracker_id, title, status, progress, portfolio_ready) values ($1,'Book trailer','done',100,true) returning id",
        [tracker],
      )
    ).rows[0]!.id;
    return { tracker, item };
  }
  const addEntry = (item: string) =>
    db.query("insert into expert_portfolio_items(expert_id, title, status, source_tracker_item_id) values ($1,'Book trailer','draft',$2)", [expert, item]);
  const entries = async (item: string) =>
    (await db.query("select 1 from expert_portfolio_items where source_tracker_item_id=$1", [item])).rows.length;

  test("nothing reaches a portfolio without recorded client consent", async () => {
    const { tracker, item } = await setup("noconsent-ab12");
    await expect(addEntry(item)).rejects.toThrow();
    // Consent must say when and how it was given.
    await expect(db.query("update client_trackers set portfolio_consent=true where id=$1", [tracker])).rejects.toThrow();
    await db.query("update client_trackers set portfolio_consent=true, consent_at=now(), consent_method='Email reply' where id=$1", [tracker]);
    await addEntry(item);
    expect(await entries(item)).toBe(1);
  });

  test("the item must be Complete and marked Portfolio ready", async () => {
    const { tracker, item } = await setup("notready-ab12");
    await db.query("update client_trackers set portfolio_consent=true, consent_at=now(), consent_method='Call' where id=$1", [tracker]);
    await db.query("update tracker_items set portfolio_ready=false where id=$1", [item]);
    await expect(addEntry(item)).rejects.toThrow();
    await db.query("update tracker_items set portfolio_ready=true, status='progress' where id=$1", [item]);
    await expect(addEntry(item)).rejects.toThrow();
  });

  test("removing consent removes the entries at once", async () => {
    const { tracker, item } = await setup("withdraw-ab12");
    await db.query("update client_trackers set portfolio_consent=true, consent_at=now(), consent_method='Email' where id=$1", [tracker]);
    await addEntry(item);
    await db.query("update client_trackers set portfolio_consent=false where id=$1", [tracker]);
    expect(await entries(item)).toBe(0);
  });

  test("reopening the item, archiving or deleting the tracker removes the entries", async () => {
    for (const change of ["reopen", "archive", "delete"] as const) {
      const { tracker, item } = await setup(`${change}-x1y2`);
      await db.query("update client_trackers set portfolio_consent=true, consent_at=now(), consent_method='Email' where id=$1", [tracker]);
      await addEntry(item);
      if (change === "reopen") await db.query("update tracker_items set status='progress', progress=90 where id=$1", [item]);
      if (change === "archive") await db.query("update client_trackers set status='archived' where id=$1", [tracker]);
      if (change === "delete") await db.query("delete from client_trackers where id=$1", [tracker]);
      expect(await entries(item)).toBe(0);
    }
  });
});
