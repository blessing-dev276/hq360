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
2. Authors with a name and book title save automatically, with progress shown.
   Missing publication dates do not block saving. Discovery metadata remains
   unverified; saving does not confirm identity or contact details.
3. **Save all ready authors** saves complete records from existing batches and
   retries unsuccessful saves. Incomplete listings remain visible; only missing
   names or titles need to be supplied.
4. Open **author details** to review saved author cards and export the batch.
   Discovery does not confirm identity or contact details.

The new API uses the existing Admin-or-Expert authorization gate. Discovery
records have RLS and no anonymous/authenticated database grants. The service-role
RPC saves a batch and its listings atomically. Retrying the same request ID
restores its batch; a new search creates a separate batch. Automatic author saving
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

## Additional review and release sources

BookLife, OnlineBookClub and BookNotification are available in the shared
Admin/Expert Author Scout selector. Migration
`20261003130000_scout_review_sources.sql` registers the sources and extends
batch saving. The migration has been applied to the linked database.

- **BookLife:** indexed public project links through SerpAPI. [BookLife's
  project catalogue](https://booklife.com/project-browse) lists indie books,
  but its robots.txt disallows direct catalogue crawling for the Scout user
  agent. The source is a candidate lead, not proof of low review volume.
- **OnlineBookClub:** indexed public book pages from its
  [Bookshelves](https://onlinebookclub.org/shelves/). A review on this site
  does not determine how many reviews the book has elsewhere.
- **BookNotification:** a bounded sample of its public
  [upcoming books list](https://www.booknotification.com/), linked to author
  pages. Its own [guide](https://www.booknotification.com/guide/) describes
  author and release tracking; it does not supply a comparable review total.
  This source offers a recent-release sample instead of genre/page filters.

All three keep the review count unknown until it is checked on a review
platform. Complete author and book pairs save automatically with the batch;
incomplete indexed listings remain available for manual completion.

Validation: `bun test tests/scout-arc.test.ts`, build and lint. A bounded live
smoke run on 2026-10-03 returned 10 BookLife project records, 10
OnlineBookClub book records (six with an author name), and five
BookNotification upcoming-release records. Search results can change; these
counts do not describe full catalogue coverage.
