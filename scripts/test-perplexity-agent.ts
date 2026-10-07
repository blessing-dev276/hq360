import { runAgent, PerplexityError } from "../src/lib/perplexity/agent.server";
if (!process.env.PERPLEXITY_API_KEY?.trim()) {
  console.error(
    "PERPLEXITY_API_KEY is missing. Set it in your terminal or .env.local; never paste it into chat.",
  );
  process.exitCode = 1;
} else {
  try {
    const response = await runAgent({
      preset: "low",
      max_steps: 2,
      input: "Find the official Perplexity API documentation URL.",
      instructions: "Use web search and answer in one short sentence.",
    });
    console.log(
      JSON.stringify({
        httpStatus: response.httpStatus,
        shape: {
          text: typeof response.text,
          sources: Array.isArray(response.sources),
          citations: Array.isArray(response.citations),
        },
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        httpStatus: error instanceof PerplexityError ? (error.upstreamStatus ?? error.status) : 502,
      }),
    );
    process.exitCode = 1;
  }
}
