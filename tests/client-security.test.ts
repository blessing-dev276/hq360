import { describe, expect, test } from "bun:test";
import {
  accessActive,
  digest,
  makeCode,
  normalizeCode,
  sameOrigin,
  stableJson,
} from "../src/lib/author-audit/client-security";

describe("Private audit access", () => {
  test("snapshot comparisons tolerate JSONB key ordering but detect changed content", () => {
    expect(stableJson({ a: 1, b: { c: 2, d: 3 } })).toBe(stableJson({ b: { d: 3, c: 2 }, a: 1 }));
    expect(stableJson({ finding: "old" })).not.toBe(stableJson({ finding: "new" }));
  });
  const enabled = {
    access_enabled: true,
    revoked_at: null,
    expires_at: null,
    version_id: "published-version",
  };
  test("requires enabled, unrevoked, published access", () => {
    expect(accessActive(enabled)).toBe(true);
    expect(accessActive({ ...enabled, access_enabled: false })).toBe(false);
    expect(accessActive({ ...enabled, revoked_at: new Date().toISOString() })).toBe(false);
    expect(accessActive({ ...enabled, version_id: null })).toBe(false);
  });
  test("enforces expiry, including invalid dates", () => {
    expect(accessActive({ ...enabled, expires_at: "2020-01-01T00:00:00Z" })).toBe(false);
    expect(accessActive({ ...enabled, expires_at: "invalid" })).toBe(false);
    expect(accessActive({ ...enabled, expires_at: "2099-01-01T00:00:00Z" })).toBe(true);
  });
  test("codes use random suffixes and tolerant normalization", () => {
    const code = makeCode("Donna Maltz");
    expect(code).toMatch(/^DONNA-[0-9A-F]{12}$/);
    expect(makeCode("Donna Maltz")).not.toBe(code);
    expect(digest(normalizeCode(code.toLowerCase().replace("-", " ")))).toBe(
      digest(normalizeCode(code)),
    );
    expect(digest("wrong code")).not.toBe(digest(normalizeCode(code)));
    expect(makeCode("")).toMatch(/^AUTHOR-/);
  });
  test("rejects missing or foreign origins for mutations", () => {
    expect(
      sameOrigin(
        new Request("https://www.hq360.space/api/private-audit", {
          headers: { origin: "https://www.hq360.space" },
        }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        new Request("https://www.hq360.space/api/private-audit", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(sameOrigin(new Request("https://www.hq360.space/api/private-audit"))).toBe(false);
  });
});
