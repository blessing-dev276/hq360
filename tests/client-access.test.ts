import { beforeEach, describe, expect, mock, test } from "bun:test";
import { digest } from "../src/lib/author-audit/client-security";

const rows: Record<string, Record<string, unknown>[]> = {};
let attempts = 0;
const database = {
  from(table: string) {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => {
        filters.push((row) => row[key] === value);
        return chain;
      },
      gt: (key: string, value: string) => {
        filters.push((row) => String(row[key]) > value);
        return chain;
      },
      maybeSingle: async () => ({
        data: rows[table]?.find((row) => filters.every((filter) => filter(row))) ?? null,
        error: null,
      }),
    };
    return chain;
  },
  rpc: async (_name: string, args: { attempt_limit: number }) => ({
    data: ++attempts <= args.attempt_limit,
    error: null,
  }),
};
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: database }));
const { clientSession, throttle } = await import("../src/lib/author-audit/client-access.server");
const token = "a".repeat(64);
const request = () =>
  new Request("https://www.hq360.space/api/private-audit", {
    headers: { cookie: `hq360_audit=${token}` },
  });
beforeEach(() => {
  attempts = 0;
  rows.audit_client_sessions = [
    {
      token_hash: digest(token),
      audit_id: "audit-a",
      generation: "generation-a",
      expires_at: "2099-01-01T00:00:00.000Z",
    },
  ];
  rows.audit_client_access = [
    {
      audit_id: "audit-a",
      generation: "generation-a",
      access_enabled: true,
      revoked_at: null,
      expires_at: null,
      version_id: "version-a",
      public_slug: "author/book",
    },
  ];
});
describe("Audit session boundary (database adapter mocked)", () => {
  test("direct unauthenticated URL is rejected", async () => {
    expect(
      await clientSession(new Request("https://www.hq360.space/api/private-audit")),
    ).toBeNull();
  });
  test("valid session resolves only its own audit", async () => {
    const session = await clientSession(request());
    expect(session?.audit_id).toBe("audit-a");
    expect(session?.public_slug).toBe("author/book");
  });
  test("forged token is rejected", async () => {
    expect(
      await clientSession(
        new Request("https://www.hq360.space/api/private-audit", {
          headers: { cookie: `hq360_audit=${"b".repeat(64)}` },
        }),
      ),
    ).toBeNull();
  });
  test("regeneration invalidates existing sessions", async () => {
    rows.audit_client_access![0]!.generation = "new-generation";
    expect(await clientSession(request())).toBeNull();
  });
  test("revocation is checked on every request", async () => {
    rows.audit_client_access![0]!.revoked_at = new Date().toISOString();
    expect(await clientSession(request())).toBeNull();
  });
  test("expired session is rejected", async () => {
    rows.audit_client_sessions![0]!.expires_at = "2020-01-01T00:00:00Z";
    expect(await clientSession(request())).toBeNull();
  });
  test("expired audit is rejected even with a valid session", async () => {
    rows.audit_client_access![0]!.expires_at = "2020-01-01T00:00:00Z";
    expect(await clientSession(request())).toBeNull();
  });
  test("persistent limiter result is enforced", async () => {
    for (let i = 0; i < 10; i++) expect(await throttle("ip:test")).toBe(true);
    expect(await throttle("ip:test")).toBe(false);
  });
});
