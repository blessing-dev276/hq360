# Perplexity author contact research

Experts open **Scouting → Email search settings** to save, replace or remove their
own Perplexity API key. Approved experts with Scouting access can find author
emails. Paid expert research uses only that expert's key, never the admin key.
Admins continue using the server's `PERPLEXITY_API_KEY`.

Research finds publicly published professional contacts using the author name
and book title. It does not send email or guarantee deliverability.

## Setup and storage

Create keys in the [Perplexity Console](https://console.perplexity.ai).
Experts enter keys in their authenticated settings, not environment files.
The settings API returns only configuration status and update time.
Credentials are encrypted with AES-256-GCM, bound to the expert ID, and stored in
`expert_perplexity_credentials`, a service-role-only table with RLS enabled.
Apply migration `20261007190000_expert_perplexity_credentials.sql` on other environments.
Encryption derives from `SUPABASE_SERVICE_ROLE_KEY`; rotating that secret requires
re-encrypting stored credentials first or asking experts to re-enter their keys.

For admin searches, set `PERPLEXITY_API_KEY` in `.env.local` and the deployment's
server environment. Local Vite loads the server-only key; restart after changing
it. Hosted deployments need their own environment setting and redeployment.
Never add a `VITE_` copy or commit a key. Rotate keys exposed in chat or logs.

No dependency was added. Native fetch calls `POST https://api.perplexity.ai/v1/agent`
with Bearer authentication, `google/gemini-3.1-flash-lite`, `web_search` and
`fetch_url`, a five-step limit, structured output, and a 90-second timeout.
Cached results and free website extraction run before paid research. Expert
searches do not use the admin's paid SerpAPI fallback. Provider usage is billed
to the key owner; these limits reduce costs but do not impose a dollar budget.
Saving a key does not make a paid validation request.
429 responses honor Retry-After: one short retry, otherwise the delay is returned
to the UI. Errors never expose provider response bodies or credentials.

## Verification and invocation

```sh
bun scripts/test-perplexity-agent.ts
bun test tests/perplexity-credentials.test.ts
bun scripts/test-expert-perplexity-settings.ts
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
