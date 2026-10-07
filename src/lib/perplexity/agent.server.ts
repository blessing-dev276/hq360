import { z } from "zod";

export class PerplexityError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: string,
    public upstreamStatus?: number,
  ) {
    super(message);
  }
}
const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});
const responseSchema = z.object({
  id: z.string(),
  status: z.string(),
  usage: z
    .object({
      cost: z
        .object({ currency: z.string(), total_cost: z.number().nonnegative() })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
  output: z.array(
    z
      .object({
        type: z.string(),
        results: z.array(sourceSchema).optional(),
        contents: z.array(sourceSchema).optional(),
        content: z
          .array(
            z
              .object({
                type: z.string(),
                text: z.string().optional(),
                annotations: z
                  .array(
                    z
                      .object({
                        type: z.string(),
                        url: z.string().optional(),
                        title: z.string().optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
  ),
});
export type AgentRequest = {
  input: string;
  instructions: string;
  model?: string;
  max_steps?: number;
  tools?: { type: "web_search" | "fetch_url" }[];
  response_format?: {
    type: "json_schema";
    json_schema: { name: string; schema: Record<string, unknown> };
  };
};
export function parseAgentResponse(raw: unknown) {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.status !== "completed")
    throw new PerplexityError("Perplexity did not complete the research. Please retry.");
  const response = parsed.data;
  const messages = response.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text");
  return {
    id: response.id,
    ...(response.usage?.cost?.currency === "USD"
      ? { costUsd: response.usage.cost.total_cost }
      : {}),
    text: messages.map((item) => item.text ?? "").join("\n"),
    sources: response.output.flatMap((item) =>
      item.type === "search_results"
        ? (item.results ?? [])
        : item.type === "fetch_url_results"
          ? (item.contents ?? [])
          : [],
    ),
    citations: messages
      .flatMap((item) => item.annotations ?? [])
      .filter((item) => item.type === "url_citation" && item.url),
  };
}
export const EMAIL_RESEARCH_MODEL = "google/gemini-3.1-flash-lite";
export async function runAgent(
  request: AgentRequest,
  fetcher: typeof fetch = fetch,
  credentials?: { apiKey: string },
) {
  const key = (credentials ? credentials.apiKey : process.env.PERPLEXITY_API_KEY)?.trim();
  if (!key)
    throw new PerplexityError(
      "Set PERPLEXITY_API_KEY in the server environment to enable author contact research.",
      503,
    );
  const signal = AbortSignal.timeout(90_000);
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetcher("https://api.perplexity.ai/v1/agent", {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EMAIL_RESEARCH_MODEL,
          max_steps: 5,
          max_output_tokens: 3000,
          tools: [{ type: "web_search" }, { type: "fetch_url" }],
          ...request,
        }),
      });
    } catch {
      throw new PerplexityError(
        "Perplexity research timed out or could not connect. Please retry.",
        504,
      );
    }
    if (response.status === 429) {
      const header = response.headers.get("retry-after");
      const seconds =
        header && /^\d+(\.\d+)?$/.test(header)
          ? Number(header)
          : header
            ? Math.ceil((Date.parse(header) - Date.now()) / 1000)
            : 1;
      const delay = Number.isFinite(seconds) ? Math.max(1, seconds) : 1;
      if (attempt === 0 && delay <= 5) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        continue;
      }
      throw new PerplexityError(
        `Perplexity is rate limited. Retry in ${delay} seconds.`,
        429,
        String(Math.ceil(delay)),
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new PerplexityError(
        "Perplexity authentication failed. Check your key in Email search settings (experts) or the server environment (admin), and ensure the Perplexity account has API access.",
        503,
        undefined,
        response.status,
      );
    if (!response.ok)
      throw new PerplexityError(
        `Perplexity research failed (HTTP ${response.status}). Please retry.`,
        502,
        undefined,
        response.status,
      );
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new PerplexityError("Perplexity returned an unreadable response.");
    }
    return { ...parseAgentResponse(raw), httpStatus: response.status };
  }
  throw new PerplexityError("Perplexity research unavailable.");
}
