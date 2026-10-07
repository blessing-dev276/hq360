import { test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { emailCoverage } from "../src/lib/scout/email-report";
import { parseAgentResponse } from "../src/lib/perplexity/agent.server";

test("budget reservations are atomic, owner scoped and settle idempotently", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE scout_authors(id uuid PRIMARY KEY);`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/20261008110000_scout_email_budget.sql", import.meta.url),
        "utf8",
      ),
    );
    const a = "00000000-0000-4000-8000-000000000001";
    await db.query("INSERT INTO scout_authors VALUES($1)", [a]);
    const { rows } = await db.query<{ id: string }>(
      "INSERT INTO scout_email_runs(owner,budget_usd,targets) VALUES('one',0.1,$1) RETURNING id",
      [JSON.stringify([{ authorId: a }])],
    );
    const run = rows[0]!.id;
    const reserve = (owner = "one") =>
      db.query<{ id: string | null }>("SELECT reserve_scout_email_pass($1,$2,$3,0) id", [
        run,
        owner,
        a,
      ]);
    expect((await reserve("other")).rows[0]!.id).toBeNull();
    const tickets = await Promise.all([reserve(), reserve(), reserve(), reserve()]);
    const issued = tickets.flatMap((t) => (t.rows[0]!.id ? [t.rows[0]!.id] : []));
    expect(issued).toHaveLength(1);
    await db.query("SELECT settle_scout_email_pass($1,NULL)", [issued[0]]);
    expect((await reserve()).rows[0]!.id).toBeNull();
    await db.query("SELECT settle_scout_email_pass($1,0.01)", [issued[0]]);
    await db.query("SELECT settle_scout_email_pass($1,0.01)", [issued[0]]);
    expect(
      Number(
        (await db.query<{ accounted_usd: string }>("SELECT accounted_usd FROM scout_email_runs"))
          .rows[0]!.accounted_usd,
      ),
    ).toBe(0.01);
    const t = "00000000-0000-4000-8000-000000000002";
    expect(
      (await db.query<{ ok: boolean }>("SELECT claim_scout_email_author($1,$2) ok", [a, t]))
        .rows[0]!.ok,
    ).toBe(true);
    expect(
      (await db.query<{ ok: boolean }>("SELECT claim_scout_email_author($1,$2) ok", [a, t]))
        .rows[0]!.ok,
    ).toBe(false);
    const grants = await db.query<{ allowed: boolean }>(
      "SELECT has_function_privilege('anon','reserve_scout_email_pass(uuid,text,uuid,integer)','EXECUTE') allowed",
    );
    expect(grants.rows[0]!.allowed).toBe(false);
  } finally {
    await db.close();
  }
});
test("coverage excludes representatives, guesses and duplicate author rows", () => {
  const contact = {
    email: "a@example.com",
    role: "author" as const,
    source_url: "https://example.com",
    evidence: "test",
    verified: true,
  };
  const r = emailCoverage(
    [
      { author_id: "a", contacts: [contact], status: "found" },
      { author_id: "a", contacts: [contact], status: "found" },
      { author_id: "b", contacts: [{ ...contact, role: "publisher" }], status: "found" },
      { author_id: "c", contacts: [{ ...contact, verified: false }], status: "paused" },
    ],
    50,
  );
  expect(r).toMatchObject({
    direct: 1,
    percent: 2,
    representative: 1,
    unverified: 1,
    total: 50,
    processed: 3,
    paused: 1,
  });
});
test("provider total cost includes tools; missing billing is never zero", () => {
  const base = { id: "a", status: "completed", output: [] };
  expect(
    parseAgentResponse({
      ...base,
      usage: { cost: { currency: "USD", total_cost: 0.042, tool_calls_cost: 0.03 } },
    }).costUsd,
  ).toBe(0.042);
  expect(parseAgentResponse(base).costUsd).toBeUndefined();
});
