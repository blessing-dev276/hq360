import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("outreach ledger is private, rejects duplicate messages and restricts follow-up statuses", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261013120000_author_outreach_history.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const insert =
      "INSERT INTO author_outreach(id,fingerprint,recipient,subject,content,sender_name,from_address,reply_to,html,plain_text) VALUES ($1,'fingerprint','author@example.com','Subject','Body','Sender','from@example.com','reply@example.com','html','text')";
    await db.query(insert, [crypto.randomUUID()]);
    await expect(db.query(insert, [crypto.randomUUID()])).rejects.toThrow();
    await expect(db.exec("UPDATE author_outreach SET workflow='unknown'")).rejects.toThrow();
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query("SELECT * FROM author_outreach")).rejects.toThrow();
      await db.exec("RESET ROLE");
    }
    expect(
      (
        await db.query<{ enabled: boolean }>(
          "SELECT relrowsecurity enabled FROM pg_class WHERE relname='author_outreach'",
        )
      ).rows[0]?.enabled,
    ).toBe(true);
  } finally {
    await db.close();
  }
});
