// Run separately so mocked authentication cannot affect other test suites.
import { mock } from "bun:test";
import assert from "node:assert/strict";
let role: string | null = null;
mock.module("../src/lib/scout/owner.server", () => ({
  resolveScoutAccess: async () => (role ? { role, owner: "test" } : null),
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
    const audience = path.includes("audience-leads");
    const id =
      current === "expert" && audience ? "00000000-0000-4000-8000-000000000001" : "invalid";
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({ action: "find-email" }),
    });
    const response = await Route.options.server.handlers.POST({ request, params: { id } });
    assert.equal(response.status, current === null ? 401 : current === "expert" ? 403 : 400);
  }
}
console.log(
  "PASS: guests denied, experts forbidden, admins proceed to validation on all four contact endpoints.",
);
