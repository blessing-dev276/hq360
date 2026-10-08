// Isolated route tests; no real user credential or database is touched.
import { mock } from "bun:test";
import assert from "node:assert/strict";
let expert: string | null = "expert-a";
let scouting = true;
let admin = false;
mock.module("../src/lib/admin-auth.server", () => ({ isAdminRequest: async () => admin }));
const rows = new Map<string, { expert_id: string; encrypted_key: string; updated_at: string }>();
mock.module("../src/lib/expert-auth.server", () => ({
  isExpertRequest: async () => expert,
  expertHasFeature: async () => scouting,
}));
mock.module("../src/lib/perplexity/credentials.server", () => ({
  encryptExpertKey: (id: string) => `encrypted-for-${id}`,
  adminCredentialDb: () => db(),
  credentialDb: () => db(),
}));
const db = () => ({
  select: (fields: string) => {
    assert.equal(fields, "updated_at");
    return {
      eq: (_key: string, id: string) => ({
        maybeSingle: async () => ({
          data: rows.has(id) ? { updated_at: rows.get(id)!.updated_at } : null,
          error: null,
        }),
      }),
    };
  },
  upsert: async (row: {
    expert_id: string;
    id?: string;
    encrypted_key: string;
    updated_at: string;
  }) => {
    rows.set(row.id ?? row.expert_id, row);
    return { error: null };
  },
  delete: () => ({
    eq: async (_key: string, id: string) => {
      rows.delete(id);
      return { error: null };
    },
  }),
});
const { perplexitySettings } = await import("../src/routes/api/expert/perplexity-settings");
async function call(
  method: string,
  body?: object,
  origin = "http://localhost",
  adminRoute = false,
) {
  return perplexitySettings(
    new Request("http://localhost/api/expert/perplexity-settings", {
      method,
      headers: { origin, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    adminRoute,
  );
}
assert.equal((await call("PUT", { apiKey: "pplx-test-placeholder-one" })).status, 200);
const state = await (await call("GET")).json();
assert.equal(state.configured, true);
assert.equal(JSON.stringify(state).includes("encrypted"), false);
assert.equal(JSON.stringify(state).includes("pplx-"), false);
assert.equal((await call("PUT", { apiKey: "pplx-test-placeholder-two" })).status, 200);
expert = "expert-b";
assert.equal((await (await call("GET")).json()).configured, false);
assert.equal((await call("DELETE")).status, 200);
assert.equal(rows.has("expert-a"), true);
assert.equal(
  (await call("PUT", { apiKey: "pplx-test-placeholder", expertId: "expert-a" })).status,
  400,
);
assert.equal(
  (await call("PUT", { apiKey: "pplx-test-placeholder" }, "https://foreign.example")).status,
  403,
);
scouting = false;
assert.equal((await call("GET")).status, 403);
scouting = true;
expert = null;
assert.equal((await call("GET")).status, 401);
expert = "expert-a";
assert.equal((await call("DELETE")).status, 200);
assert.equal(rows.size, 0);
console.log(
  "PASS: settings save, replace, remove, ownership isolation, secret redaction, permission and origin checks.",
);

assert.equal((await call("GET", undefined, "http://localhost", true)).status, 401);
admin = true;
assert.equal(
  (await call("PUT", { apiKey: "pplx-admin-placeholder" }, "http://localhost", true)).status,
  200,
);
assert.equal(rows.has("admin"), true);
assert.equal((await (await call("GET")).json()).configured, false);
assert.equal((await call("DELETE", undefined, "https://foreign.example", true)).status, 403);
assert.equal((await call("DELETE", undefined, "http://localhost", true)).status, 200);
assert.equal(rows.size, 0);
console.log("PASS: admin authorization, storage isolation and origin checks.");
