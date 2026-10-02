# Early-review author discovery

The shared Admin/Expert Author Scout source selector now includes NetGalley,
BookSirens, Booksprout and StoryOrigin alongside Reedsy and Readers’ Favorite.
Each search saves a batch, including incomplete listings. Genre, publication
window and an explicit include-unknown-dates option narrow discovery. Public
catalogue samples and search-index results are bounded to ten listings.

## Source coverage

- **BookSirens:** reads a bounded sample of guest-accessible catalogue/book
  pages, checks robots.txt, skips login redirects, and extracts labeled book
  metadata. Not a complete inventory. Unsupported public genre selections
  return an error; they do not silently search all genres.
- **NetGalley:** searches indexed public book links using SerpAPI. No direct
  catalogue scraping ([terms, section 4](https://www.netgalley.com/terms)).
- **Booksprout:** searches indexed public review-copy links. Its reviewer
  catalogue is a JavaScript application; indexed coverage can be incomplete.
- **StoryOrigin:** searches indexed public review-copy links. Does not harvest
  member directories or contacts ([terms, section 2.2](https://storyoriginapp.com/terms)).

Any source accepts an individual book/review-copy link for manual review. Only
source-specific HTTPS book URLs are accepted; tracking parameters are removed.
Search-index snippets are evidence, not verified metadata. Publication dates
must be explicitly labeled; Google timestamps and review deadlines are not used.
A review-copy listing does not prove low/zero reviews, independent publication,
or interest in commercial services. Review counts remain unknown.

## Batch workflow

1. Pick a source and filters, then search to save a discovery batch.
2. Open the batch dropdown. Follow a listing’s source link and confirm its book
   title, author name and optional publication date.
3. Save the author; incomplete listings remain in the discovery batch.
4. Open **author details & batch email discovery** to use the existing author
   cards, entire-batch email search, verification and CSV export. Only confirmed
   author records participate in email discovery. Found addresses remain
   unverified until confirmed; this action does not send messages.

The new API uses the existing Admin-or-Expert authorization gate. Discovery
records have RLS and no anonymous/authenticated database grants. The service-role
RPC saves a batch and its listings atomically. Retrying the same request ID
restores its batch; a new search creates a separate batch. Author confirmation
uses the existing manual ingest flow; retrying a failed link step reuses its
saved author/book. Discovery batch counts describe listings; author batch views
count saved books.

## Configuration and validation

Search-index sources require `SERPAPI_API_KEY`. Apply
`20261002120000_scout_arc.sql` before deploying the app.

- `bun test tests/scout-arc.test.ts tests/scout-audience.test.ts`
- `bun run build` and `bun run lint`
- Run a production preview, then
  `SCOUT_TEST_URL=http://127.0.0.1:8083 bun scripts/test-arc-scout-browser.mjs`.
  Browser tests mock APIs and perform no live source/database writes.

A bounded live smoke test on 2026-10-02 returned three records from each source.
BookSirens supplied authors and publication dates; NetGalley supplied authors but
no dates in that sample; Booksprout and StoryOrigin returned review-copy links
without authors or dates. These observations describe that sample, not guaranteed
coverage. Search listings can be stale; confirm availability on the source page.
