# Perplexity author contact research

Admin Scout → a saved author/book card → **Find author email**.
Email discovery and contact confirmation are admin-only, enforced by the server;
expert workspaces do not show the discovery controls. This uses the author
name and selected book title to research public professional contact addresses,
including Gmail when the author publishes it for contact. Public Facebook pages,
author sites, publishers, agents and interviews are included in the research
instructions. Private pages, inaccessible sources and missing addresses may yield
no result. It does not send email or promise exhaustive coverage or deliverability.

## Setup

Set `PERPLEXITY_API_KEY` in `.env.local` and the deployment's server environment.
Never add a `VITE_` copy or commit a key. Create/rotate keys in the
[Perplexity Console](https://console.perplexity.ai). Restart the local server after
changing its environment. Rotate any key exposed in a chat or log.

No dependency was added: the TypeScript server uses native fetch with
`POST https://api.perplexity.ai/v1/agent`, Bearer authentication, the `low` preset,
explicit `web_search` and `fetch_url` tools, up to five steps, a 90-second timeout,
and structured `response_format` output. Model/tool usage incurs provider charges.
429 responses honor Retry-After: one short retry, otherwise the delay is returned
to the UI. Authentication errors expose a setup message, never provider bodies.

## Verification and invocation

```sh
bun scripts/test-perplexity-agent.ts
bun test tests/perplexity-agent.test.ts
bun run lint
bunx tsc --noEmit
bun run build
```

The smoke test makes a minimal real web-grounded request and prints only HTTP
status and response shape. HTTP 401 indicates a key problem; HTTP 429 indicates
rate limiting. The contact-search route remains authenticated and scoped to the
user's Scout workspace, with same-origin POST validation:

```ts
// Run from the authenticated application's browser context.
const response = await fetch(`/api/admin/scout-authors/${authorId}/find-contact`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ bookId }),
});
const result = await response.json();
```

The server verifies that the selected book belongs to the author. It reads answer
text from `output[].content[]` output_text entries, sources from search_results
and fetch_url_results, and URL citations from text annotations. Only candidate
emails literally present in retrieved text at the cited URL survive validation.
A model-generated excerpt or citation alone is insufficient. Candidates remain
unverified; representative contacts are labeled separately. Research notes retain
evidence. Only author-role candidates update the author email, and existing
staff-verified emails are preserved. Social/representative pages never replace
an author's official website.

The reusable server helper is `src/lib/perplexity/agent.server.ts`; contact-specific
validation is `src/lib/scout/perplexity-contact.server.ts`.

## References

- [Documentation index](https://docs.perplexity.ai/llms.txt)
- [Agent quickstart](https://docs.perplexity.ai/docs/agent-api/quickstart)
- [Agent request/response reference](https://docs.perplexity.ai/api-reference/agent-post)
- [Presets](https://docs.perplexity.ai/docs/agent-api/presets)
- [Tools](https://docs.perplexity.ai/docs/agent-api/tools/overview)
- [Structured output](https://docs.perplexity.ai/docs/agent-api/output-control)
- [SDK overview](https://docs.perplexity.ai/docs/sdk/overview)
- [Pricing](https://docs.perplexity.ai/docs/getting-started/pricing)
- [Rate limits](https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers)
