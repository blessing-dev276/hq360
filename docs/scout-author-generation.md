# Author generation

Reedsy and Readers’ Favorite searches accept a typed count of 1–100 authors per batch. The generation panel supports up to three unfinished batches in the current tab, including paused or failed batches. Each batch has separate pause, resume/retry and progress controls. Keep the tab open: job cursors and pending candidates live in browser memory; saved results survive closing or reloading it. Pause lets requests already in flight finish before starting more work.

Searches continue through catalogue pages until the requested number of new authors is saved or the available catalogue ends. Reedsy shares short-lived source page requests between simultaneous batches. Saves use four concurrent requests per batch. Source rate limits are respected with bounded retries.

Apply `supabase/migrations/20261005120000_scout_unique_workspace_authors.sql` **before deploying the application changes**. It backfills workspace history from all existing batch memberships and prospects, without removing existing records. A database primary key atomically claims each normalized author name per workspace, preventing concurrent batches from adding the same author. Prospect claims allow a generated author to be scouted once. Batch membership writes enforce the requested count and a ceiling of 100.

Matching is conservative: capitalization and repeated whitespace are normalized, and the same name across different books or sources is excluded. Distinct people with identical names are also excluded within one workspace; aliases with different names are not automatically identified. The shared author catalogue is not merged. Other experts can independently discover the same author.

Verification:

- `bun test tests/scout-unique-authors.test.ts tests/scout-database.test.ts`
- Start a local preview, then `SCOUT_TEST_URL=http://127.0.0.1:8082 bun scripts/test-scout-batches-browser.mjs` (fixture API responses; no production writes).
