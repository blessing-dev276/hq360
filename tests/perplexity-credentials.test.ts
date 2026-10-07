import { expect, test } from "bun:test";
import {
  encryptExpertKey,
  decryptExpertKey,
  keyForSearch,
} from "../src/lib/perplexity/credentials.server";
import { EMAIL_RESEARCH_MODEL, runAgent } from "../src/lib/perplexity/agent.server";
const secret = "test-only-encryption-secret";
const key = "pplx-test-only-placeholder";
test("credentials are encrypted, randomized and bound to their expert", () => {
  const encrypted = encryptExpertKey("expert-a", key, secret);
  expect(encrypted).not.toContain(key);
  expect(encryptExpertKey("expert-a", key, secret)).not.toBe(encrypted);
  expect(decryptExpertKey("expert-a", encrypted, secret)).toBe(key);
  expect(() => decryptExpertKey("expert-b", encrypted, secret)).toThrow();
  expect(() => decryptExpertKey("expert-a", encrypted, "wrong-secret")).toThrow();
});
test("expert searches use only their own credential and never the server key", async () => {
  const requested: string[] = [];
  const load = async (id: string) => {
    requested.push(id);
    return id === "expert-a" ? key : null;
  };
  expect(await keyForSearch({ role: "expert", expertId: "expert-a" }, load)).toBe(key);
  await expect(keyForSearch({ role: "expert", expertId: "expert-b" }, load)).rejects.toThrow(
    "Add your own Perplexity API key",
  );
  expect(requested).toEqual(["expert-a", "expert-b"]);
});
test("request credentials stay out of the prompt/body and Luna is the default model", async () => {
  const fetcher = (async (_url, init) => {
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${key}`);
    expect(String(init?.body)).not.toContain(key);
    expect(JSON.parse(String(init?.body)).model).toBe(EMAIL_RESEARCH_MODEL);
    return Response.json({
      id: "test",
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
    });
  }) as typeof fetch;
  await runAgent({ input: "public author and book", instructions: "find email" }, fetcher, {
    apiKey: key,
  });
  await expect(
    runAgent({ input: "test", instructions: "test" }, fetcher, { apiKey: "" }),
  ).rejects.toThrow("Set PERPLEXITY_API_KEY");
});
