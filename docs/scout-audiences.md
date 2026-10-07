# Maps and web audience scouting

Both `/admin#scout` and `/expert#scout` use the same audience selector. Authors keep the existing Reedsy / Readers’ Favorite workflow. Other HQ360 audiences can choose **Google Maps** or **Web search**, enter a niche and location, and save up to 10 or 20 results per search as a batch. Maps requires a location. Each page is a separate search/batch; Maps pages use the provider’s 20-result pagination.

## Setup

- Apply `supabase/migrations/20261002090000_scout_audiences.sql` to the same database used by the application.
- Configure server-only `SERPAPI_API_KEY`, plus the existing Supabase environment variables. Never expose the SerpAPI or service-role key with a `VITE_` prefix.
- Deploy the application build containing the new API routes. No extra connector is required.

Provider documentation: [Maps](https://serpapi.com/google-maps-api), [Google web search](https://serpapi.com/search-api).

A Maps search uses one provider request. A web search uses one request for up to 10 results or two for up to 20. Email discovery uses up to one search per lead lacking an email. Search quotas belong to the configured SerpAPI account. Provider errors are surfaced as errors, not empty successful batches.

## Storage and behavior

- `scout_audience_batches`, `scout_audience_leads` and `scout_audience_batch_leads` keep businesses and creators separate from author/book records.
- Batch persistence is transactional. The client reuses a request UUID after failure, preventing duplicate batches when a response is lost. New searches create new batches, including zero-result searches. Repeated leads reuse their source identity; existing contact verification and shortlisting are retained.
- Cross-source identity is not automatically merged. A Maps listing and a web page may describe the same entity; review them before outreach.
- Admins and approved experts share these workspace records. All endpoints use the existing admin-or-expert authorization. Anonymous/authenticated Supabase clients have no direct table or RPC access.
- Batch email discovery runs at most two requests concurrently, can be stopped, and skips existing emails. It searches publicly indexed snippets on the listed website; it does not crawl arbitrary URLs or infer email addresses. Shared-platform URLs are scoped to the exact profile path.
- Emails have source evidence and start unverified. Review the evidence before explicitly verifying. Not every business has an indexed email or a website.
- CSV export includes the currently filtered leads, source links, Maps ratings/counts where available, email evidence and verification status. Spreadsheet-formula prefixes are escaped.

## Validation

`bun test tests/scout-audience.test.ts` covers schemas, source normalization, email evidence scoping, provider failures, SQL permissions, atomic saves and idempotency.

Run a production preview, then `SCOUT_TEST_URL=http://127.0.0.1:8081 bun scripts/test-audience-scout-browser.mjs` for fixture-backed browser validation. Fixtures never insert production test records.
