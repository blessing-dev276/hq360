import { expect, test } from "bun:test";
import { findAuthorContacts } from "../src/lib/scout/gemini-contact.server";

function mockFetch(answer: unknown, pages: Record<string, string>) {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("generativelanguage.googleapis.com"))
      return Response.json({
        candidates: [
          {
            content: { parts: [{ text: "```json\n" + JSON.stringify(answer) + "\n```" }] },
            groundingMetadata: {
              groundingChunks: [{ web: { uri: "https://jane.example.com", title: "Jane" } }],
            },
          },
        ],
      });
    return url in pages ? new Response(pages[url]) : new Response("", { status: 404 });
  }) as typeof fetch;
}

test("keeps only emails that appear on the cited page", async () => {
  process.env.GEMINI_API_KEY = "test";
  const result = await findAuthorContacts(
    { author: "Jane Doe", book: "Book" },
    mockFetch(
      {
        identity_match: true,
        summary: "",
        contacts: [
          {
            email: "jane@janedoe.com",
            role: "author",
            source_url: "https://janedoe.com/contact",
            evidence: "x",
          },
          {
            email: "made.up@janedoe.com",
            role: "author",
            source_url: "https://janedoe.com/contact",
            evidence: "x",
          },
        ],
      },
      { "https://janedoe.com/contact": '<a href="mailto:jane@janedoe.com">Email me</a>' },
    ),
  );
  expect(result.contacts.map((c) => c.email)).toEqual(["jane@janedoe.com"]);
});

test("asks for the key when it is missing", async () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  await expect(findAuthorContacts({ author: "A", book: "B" }, mockFetch({}, {}))).rejects.toThrow(
    /GEMINI_API_KEY/,
  );
});
