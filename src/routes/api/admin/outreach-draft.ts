import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const schema = z
  .object({
    prompt: z.string().trim().min(10).max(12000),
    model: z.string().max(80).optional(),
    author: z
      .object({
        name: z.string().trim().min(1).max(200),
        bookTitle: z.string().trim().min(1).max(300),
        genre: z.string().trim().max(120).optional(),
        description: z.string().trim().max(4000).optional(),
        sourceUrl: z.string().trim().max(2000).optional(),
      })
      .strict(),
  })
  .strict();

const INSTRUCTIONS = `You write one personalised outreach email from HQ360 (author services) to one author.
Follow the USER'S OUTREACH PROMPT exactly: its tone, structure, length, offers and call to action.
Personalise it with the BOOK facts given. Use only those facts: never invent reviews, rankings, sales, awards or claims about the author.
Formatting: plain text paragraphs separated by blank lines. A service block may start with **Service name**: followed by its text. No HTML, no links unless the prompt gives them, no signature (it is added automatically).
Answer with JSON only: {"subject": string (one line, under 120 characters), "content": string}.`;

/** Drafts (never sends) one personalised author email from the admin's own prompt. */
export const Route = createFileRoute("/api/admin/outreach-draft")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAdminRequest } = await import("@/lib/admin-auth.server");
        if (!(await isAdminRequest(request))) return json({ error: "Unauthorized" }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json({ error: "Invalid origin" }, 403);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Add your outreach prompt and the book." }, 400);
        const { prompt, author, model } = parsed.data;
        const { runAgent, PerplexityError } = await import("@/lib/perplexity/agent.server");
        const { adminKeyForResearch } = await import("@/lib/perplexity/credentials.server");
        const { DEFAULT_AGENT_MODEL, isAgentModel } = await import("@/lib/trackers/agent-models");
        try {
          const apiKey = await adminKeyForResearch();
          const response = await runAgent(
            {
              model: model && isAgentModel(model) ? model : DEFAULT_AGENT_MODEL,
              instructions: INSTRUCTIONS,
              input: `USER'S OUTREACH PROMPT\n${prompt}\n\nBOOK\nAuthor: ${author.name}\nTitle: ${author.bookTitle}${author.genre ? `\nGenre: ${author.genre}` : ""}${author.description ? `\nAbout the book: ${author.description}` : ""}${author.sourceUrl ? `\nListing: ${author.sourceUrl}` : ""}`,
              tools: [],
              max_steps: 1,
              max_output_tokens: 2500,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "outreach_draft",
                  schema: {
                    type: "object",
                    properties: { subject: { type: "string" }, content: { type: "string" } },
                    required: ["subject", "content"],
                  },
                },
              },
            },
            fetch,
            { apiKey },
          );
          const text = response.text;
          const draft = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
            subject?: string;
            content?: string;
          };
          const subject = (draft.subject ?? "")
            .replace(/[\r\n]+/g, " ")
            .trim()
            .slice(0, 200);
          const content = (draft.content ?? "").trim().slice(0, 20000);
          if (!subject || !content) return json({ error: "The draft came back empty." }, 502);
          return json({ subject, content, costUsd: response.costUsd ?? null });
        } catch (error) {
          if (error instanceof PerplexityError) return json({ error: error.message }, error.status);
          return json({ error: "Could not draft this email. Try again." }, 503);
        }
      },
    },
  },
});
