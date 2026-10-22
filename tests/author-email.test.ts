import { afterEach, expect, test } from "bun:test";
import {
  authorEmailSchema,
  buildAuthorEmail,
  exampleContent,
  exampleSubject,
} from "../src/lib/author-email";
import { handleAuthorEmail } from "../src/lib/author-email.server";
import { sessionCookie } from "../src/lib/admin-auth.server";

const originalFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...env };
});
const draft = {
  to: "author@example.com",
  subject: exampleSubject,
  content: exampleContent,
  senderName: "Racheal Eniola",
  requestId: "bca6c778-5d07-4f5b-9093-48a68b989d24",
};
test("HTML escapes untrusted input and preserves service headings and text alternative", () => {
  const email = buildAuthorEmail({
    ...draft,
    content: '**Research**: <script>alert("x")</script>\n\nHello & welcome',
  });
  expect(email.html).not.toContain("<script>");
  expect(email.html).toContain("&lt;script&gt;");
  expect(email.html).toContain("border-left:3px solid #ff5a00");
  expect(email.text).toContain("Research: <script>");
  expect(email.text).toContain("Reply STOP");
  expect(email.html).toContain("Racheal Eniola");
});
test("rejects multiple recipients, header injection and oversized content", () => {
  for (const override of [
    { to: "a@example.com,b@example.com" },
    { subject: "Hi\r\nBcc: x@example.com" },
    { content: "x".repeat(20001) },
  ])
    expect(authorEmailSchema.safeParse({ ...draft, ...override }).success).toBe(false);
});
async function request(body: unknown = draft, origin = "https://www.hq360.space") {
  const cookie = (await sessionCookie()).split(";")[0]!;
  return new Request("https://www.hq360.space/api/admin/author-email", {
    method: "POST",
    headers: { cookie, origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function configure() {
  process.env.SUPABASE_URL = "https://outreach-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.ADMIN_PASSWORD = "test-password";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "HQ360 <hello@hq360.space>";
  process.env.AUTHOR_EMAIL_REPLY_TO = "replies@hq360.space";
}
test("admin and origin checks prevent unauthorized sends", async () => {
  configure();
  globalThis.fetch = (() => {
    throw new Error("Must not call provider");
  }) as typeof fetch;
  expect(
    (await handleAuthorEmail(new Request("https://www.hq360.space/api/admin/author-email"))).status,
  ).toBe(401);
  expect((await handleAuthorEmail(await request(draft, "https://other.example"))).status).toBe(403);
  expect((await handleAuthorEmail(await request({ ...draft, to: "invalid" }))).status).toBe(400);
  delete process.env.AUTHOR_EMAIL_REPLY_TO;
  expect((await handleAuthorEmail(await request())).status).toBe(503);
});
test("sends both formats, monitored reply address and stable retry key", async () => {
  configure();
  const keys: string[] = [];
  const rows: Record<string, unknown>[] = [];
  globalThis.fetch = mockDatabase(rows, async (_url, init) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
    const body = JSON.parse(String(init?.body));
    expect(body.reply_to).toBe("replies@hq360.space");
    expect(body.to).toEqual([draft.to]);
    expect(body.html).toContain("Goodreads Listopia Placement");
    expect(body.text).toContain("Racheal Eniola");
    return Response.json({ id: "email-123" });
  });
  for (let i = 0; i < 2; i++)
    expect(await (await handleAuthorEmail(await request())).json()).toMatchObject({
      accepted: true,
      id: "email-123",
    });
  expect(keys).toEqual([`author-outreach/${draft.requestId}`]);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.send_status).toBe("accepted");
});
test("provider failure is never reported as acceptance or leaked to the client", async () => {
  configure();
  globalThis.fetch = mockDatabase(
    [],
    async () => new Response("private-provider-detail", { status: 422 }),
  );
  const response = await handleAuthorEmail(await request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-provider-detail");
});

// Mock the database HTTP boundary; no tests can reach a real provider or database.
function mockDatabase(rows: Record<string, unknown>[], provider: typeof fetch): typeof fetch {
  return (async (url, init) => {
    const target = new URL(String(url));
    if (target.hostname === "api.resend.com") return provider(url, init);
    expect(target.hostname).toBe("outreach-test.supabase.co");
    const method = init?.method || "GET";
    const headers = new Headers(init?.headers);
    const matching = rows.filter((row) =>
      [...target.searchParams].every(([key, value]) => {
        if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
        if (value.startsWith("neq.")) return String(row[key]) !== value.slice(4);
        if (key === "or")
          return (
            row.workflow === "opted_out" ||
            ["bounced", "complained", "suppressed"].includes(String(row.delivery_status))
          );
        return true;
      }),
    );
    if (method === "POST") {
      const data = JSON.parse(String(init?.body));
      if (rows.some((row) => row.id === data.id || row.fingerprint === data.fingerprint))
        return Response.json({ code: "23505" }, { status: 409 });
      const row = {
        ...data,
        created_at: new Date().toISOString(),
        send_status: "pending",
        workflow: "awaiting_reply",
      };
      rows.push(row);
      return Response.json(row, { status: 201 });
    }
    if (method === "PATCH") {
      matching.forEach((row) => Object.assign(row, JSON.parse(String(init?.body))));
      return headers.get("prefer")?.includes("return=representation")
        ? Response.json(matching)
        : new Response(null, { status: 204 });
    }
    return Response.json(
      headers.get("accept")?.includes("vnd.pgrst.object") ? matching[0] || null : matching,
      { headers: { "Content-Range": `0-${matching.length}/${matching.length}` } },
    );
  }) as typeof fetch;
}
test("history failure prevents sending and uncertain attempts retain the same retry reference", async () => {
  configure();
  let calls = 0;
  const rows: Record<string, unknown>[] = [];
  globalThis.fetch = mockDatabase(rows, (async () => {
    calls++;
    throw new Error("timeout");
  }) as typeof fetch);
  expect((await handleAuthorEmail(await request())).status).toBe(502);
  expect(rows[0]?.send_status).toBe("unconfirmed");
  const keys: string[] = [];
  globalThis.fetch = mockDatabase(rows, (async (_url, init) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
    return Response.json({ id: "email-456" });
  }) as typeof fetch);
  expect(
    (await handleAuthorEmail(await request({ ...draft, requestId: crypto.randomUUID() }))).status,
  ).toBe(200);
  expect(keys).toEqual([`author-outreach/${draft.requestId}`]);
  expect(rows).toHaveLength(1);
  expect(calls).toBe(1);
  globalThis.fetch = (async () =>
    Response.json({ message: "database unavailable" }, { status: 400 })) as typeof fetch;
  expect((await handleAuthorEmail(await request())).status).toBe(503);
});
test("opt-outs block sending and stale uncertain attempts cannot be retried", async () => {
  configure();
  const rows: Record<string, unknown>[] = [
    { recipient: draft.to, is_test: false, workflow: "opted_out" },
  ];
  globalThis.fetch = mockDatabase(rows, (async () => {
    throw new Error("Must not send");
  }) as typeof fetch);
  expect((await handleAuthorEmail(await request())).status).toBe(409);
  rows.length = 0;
  await handleAuthorEmail(await request());
  rows[0]!.created_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  expect((await handleAuthorEmail(await request())).status).toBe(409);
});

test("history supports saved follow-ups and verified delivery checks", async () => {
  configure();
  const { listOutreach, updateOutreach } = await import("../src/lib/author-outreach.server");
  const rows: Record<string, unknown>[] = [
    {
      id: draft.requestId,
      recipient: draft.to,
      provider_id: "email-123",
      source: "composer",
      is_test: false,
      workflow: "awaiting_reply",
    },
  ];
  globalThis.fetch = mockDatabase(rows, (async () =>
    Response.json({ last_event: "delivered" })) as typeof fetch);
  expect(
    (
      await (
        await listOutreach(
          new Request("https://www.hq360.space/api/admin/author-outreach?kind=authors"),
        )
      ).json()
    ).total,
  ).toBe(1);
  expect(
    (
      await updateOutreach(
        await request({
          id: draft.requestId,
          workflow: "interested",
          notes: "Asked for a plan",
          followUpOn: "2026-10-20",
        }),
      )
    ).status,
  ).toBe(200);
  expect(rows[0]?.notes).toBe("Asked for a plan");
  expect(
    (await updateOutreach(await request({ action: "refresh", id: draft.requestId }))).status,
  ).toBe(200);
  expect(rows[0]?.delivery_status).toBe("delivered");
  expect(
    (
      await updateOutreach(
        await request({
          id: draft.requestId,
          workflow: "interested",
          notes: "",
          followUpOn: "2026-02-30",
        }),
      )
    ).status,
  ).toBe(400);
  globalThis.fetch = mockDatabase(rows, (async () =>
    Response.json({ error: "forbidden" }, { status: 403 })) as typeof fetch);
  expect(
    (await updateOutreach(await request({ action: "refresh", id: draft.requestId }))).status,
  ).toBe(502);
  expect(rows[0]?.delivery_status).toBe("delivered");
});
