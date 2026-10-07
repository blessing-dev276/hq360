// Run separately so mocked authentication cannot affect other test suites.
import { mock } from "bun:test";
import assert from "node:assert/strict";
let role: string | null = null;
mock.module("../src/lib/scout/owner.server", () => ({
  resolveScoutAccess: async () => (role ? { role, owner: "test" } : null),
  canFindContacts: async () => role === "admin" || role === "expert",
  canSeeAuthor: async () => {
    throw new Error("Authorization must run before database access");
  },
  canSeeAudienceLead: async () => {
    throw new Error("Authorization must run before database access");
  },
}));
for (const path of [
  "../src/routes/api/admin/scout-authors.$id.find-contact",
  "../src/routes/api/admin/scout-authors.$id.confirm-contact",
  "../src/routes/api/admin/scout-authors.$id.research-website",
  "../src/routes/api/admin/scout-audience-leads.$id",
]) {
  const { Route } = await import(path);
  for (const current of [null, "expert", "admin"]) {
    role = current;
    const id = "invalid";
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({ action: "find-email" }),
    });
    const response = await Route.options.server.handlers.POST({ request, params: { id } });
    assert.equal(
      response.status,
      current === null
        ? 401
        : current === "expert" && path.includes("research-website")
          ? 403
          : 400,
    );
  }
}
console.log(
  "PASS: guests denied; authorized experts can find/confirm contacts; website research remains admin-only.",
);
