// Isolated authorization, approval and inquiry tests. No real database or messages.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import ruth from "../tests/fixtures/ruth-foster-audit.json";
import { buildCommercialPlan } from "../src/lib/author-audit/commercial";
const id = "00000000-0000-4000-8000-000000000001";
let admin = true,
  authenticated = true,
  origin = "http://localhost",
  failInsert = false;
let revision = 12;
const snapshot = {
  ...ruth,
  revision,
  ctaEnabled: true,
  workflowVersion: 1,
  objective: "Develop relevant reader relationships",
};
let proposal: Record<string, unknown> | null = null;
const inquiries: Record<string, unknown>[] = [];
const db = {
  rpc: async () => ({ error: null }),
  from(table: string) {
    let op = "select",
      values: Record<string, unknown> = {};
    const filters: [string, unknown][] = [];
    const execute = () => {
      if (table === "audit_commercial_config") return { data: null, error: null };
      if (table === "author_audits") return { data: { workflow_revision: revision }, error: null };
      if (table === "project_inquiries") {
        if (failInsert) return { data: null, error: new Error("offline") };
        inquiries.push(values);
        return { data: { id: "saved-inquiry" }, error: null };
      }
      if (table === "audit_proposals") {
        if (op === "insert") {
          proposal = { ...values };
          return { data: proposal, error: null };
        }
        const matches = proposal && filters.every(([k, v]) => proposal![k] === v);
        if (op === "update") {
          if (!matches) return { data: null, error: new Error("conflict") };
          proposal = { ...proposal, ...values };
        }
        return { data: matches ? proposal : null, error: null };
      }
      throw new Error(`Unexpected table ${table}`);
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        filters.push([key, value]);
        return query;
      },
      insert: (v: Record<string, unknown>) => {
        op = "insert";
        values = v;
        return query;
      },
      update: (v: Record<string, unknown>) => {
        op = "update";
        values = v;
        return query;
      },
      maybeSingle: async () => execute(),
      single: async () => execute(),
    };
    return query;
  },
};
mock.module("../src/lib/author-audit/workflow-access.server", () => ({
  auditActor: async () => ({ admin, id: admin ? "admin" : "expert" }),
}));
mock.module("../src/lib/author-audit/workflow.server", () => ({
  workflowState: async () => ({
    audit: { workflow_revision: revision },
    findings: snapshot.findings,
  }),
  clientSnapshot: () => snapshot,
}));
mock.module("../src/lib/author-audit/client-access.server", () => ({
  clientDb: () => db,
  clientSession: async () => (authenticated ? { audit_id: id } : null),
  snapshotFor: async () => snapshot,
  throttle: async () => true,
  privateJson: (body: unknown, status = 200) => Response.json(body, { status }),
}));
const { commercialAdmin, clientCommercial, auditInquiry } =
  await import("../src/lib/author-audit/commercial.server");
const request = (body?: object) =>
  new Request("http://localhost/api/test", {
    method: body ? "POST" : "GET",
    headers: { origin, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const act = (action: string, extra = {}) =>
  commercialAdmin(request({ action, revision: proposal?.revision ?? 0, ...extra }), id);
admin = false;
assert.equal((await act("generate")).status, 403);
admin = true;
origin = "https://foreign.example";
assert.equal((await act("generate")).status, 403);
origin = "http://localhost";
assert.equal((await act("generate")).status, 200);
assert.equal(proposal!.status, "draft");
assert.equal((await act("share")).status, 409);
assert.equal((await (await clientCommercial(request())).json()).proposal, null);
assert.equal((await act("approve")).status, 200);
assert.equal((await (await clientCommercial(request())).json()).proposal, null);
assert.equal((await act("share")).status, 200);
assert.ok((await (await clientCommercial(request())).json()).proposal);
const draft = proposal!.draft;
assert.equal((await act("save", { draft })).status, 200);
assert.equal(proposal!.status, "draft");
assert.equal(proposal!.approved_at, null);
assert.equal((await (await clientCommercial(request())).json()).proposal, null);
assert.equal((await act("approve", { revision: 1 })).status, 409);
revision++;
assert.equal((await act("approve")).status, 409);
const service = buildCommercialPlan(snapshot.findings).services[0]!;
const inquiry = {
  name: "Test Author",
  email: "reader@example.com",
  message: "Discuss this scope",
  consent: true,
  serviceId: service.id,
  findingIds: service.matches.map((m) => m.finding_id),
};
authenticated = false;
assert.equal((await auditInquiry(request(inquiry))).status, 401);
authenticated = true;
assert.equal((await auditInquiry(request({ ...inquiry, consent: false }))).status, 400);
assert.equal((await auditInquiry(request({ ...inquiry, serviceId: "billboards" }))).status, 400);
assert.equal((await auditInquiry(request({ ...inquiry, findingIds: [id] }))).status, 400);
assert.equal((await auditInquiry(request(inquiry))).status, 201);
assert.equal(inquiries.length, 1);
assert.equal(inquiries[0]!.source_path, "/author-audit");
assert.ok(!JSON.stringify(inquiries).includes("public_slug"));
failInsert = true;
assert.equal((await auditInquiry(request(inquiry))).status, 503);
console.log(
  "PASS: admin-only proposals, origin checks, approval/sharing, stale revisions, private inquiry validation, persistence and failure handling.",
);
