# Readers’ Favorite Scout source

A separate source selector in Scout keeps Reedsy Discovery available and adds Readers’ Favorite.

1. Choose **Readers’ Favorite**, then search the initial genre. The response populates the genre selector from the site's public genre links (166 found during the read-only check).
2. Choose another genre or paste its Readers’ Favorite genre URL. Each request reads one catalog page, with explicit **Load next page** navigation. Scores can be filtered without refetching.
3. Select results to import. The existing ingestion endpoint preserves book/source identity and batch membership; successful rows are removed from the selection so partial failures can be retried.
4. Use **Save for follow-up** on imported books to enter the existing prospect/lead process. Existing exclusions remain enforced. No outreach is sent automatically.

Only title, public author name, genre, source URL and editorial star score are collected. The score is stored in `rating`; unknown review counts remain null. Debut/indie status and contact details are not inferred. Contact research and human identity review remain separate existing steps. Books from different sources are not merged solely because names match.

The search endpoint requires admin authentication, accepts only HTTPS genre paths on readersfavorite.com, checks robots.txt at runtime, refuses redirects, bounds response size/time, throttles uncached lookups and caches results briefly. Unexpected/challenge pages are errors rather than empty results. These limits are per server instance; this is a staff-driven source, not a scheduled bulk crawler.

Source inspection: [Readers’ Favorite](https://readersfavorite.com/), its [public thriller catalog](https://readersfavorite.com/book-reviews/book-reviews-genre-fiction-thriller-general.htm), and [robots.txt](https://readersfavorite.com/robots.txt). No account, CAPTCHA workaround, contact submission or outreach was used.

## Activation

Verified on 1 October 2026: the linked project `ihvccuqytxrxnqectivg` is up to date, the Readers’ Favorite source is enabled, and the review-platform constraint includes `readers_favorite`. Migration: `supabase/migrations/20260930130000_scout_readers_favorite.sql`. Counts before and after verification remain 295 authors, 333 discovered books, 5 prospects, 232 review records and 2 invoices. No test imports, outreach or payments were made.

## Validation

- Build, TypeScript check and focused ESLint: passed.
- Fifteen targeted parser/database/sales tests passed (zero failures).
- Parser tests cover catalog extraction, unknown ratings, pagination, off-site URLs and unexpected pages.
- PGlite migration test covers repeat application, preserving Reedsy records and storing stars separately from review counts.
- A read-only live catalog check confirmed the public markup and genre links.
- Mocked browser checks cover switching sources, searching, filtering, selected import, rating semantics, follow-up and mobile overflow. No real imports or messages are submitted by tests.
