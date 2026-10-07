# HQ360 search discovery audit — 10 September 2026

Implementation is in the local repository. It has not been deployed, pushed or submitted to search engines. The existing production host is **Vercel**, confirmed by live response headers and the repository's Nitro preset. The older Cloudflare note in AGENTS.md does not describe this build.

## Completed in code

- Added an explicit `OAI-SearchBot: Allow: /` group and sitemap reference to `public/robots.txt`. **GPTBot's existing configuration is preserved:** there was no dedicated group; it still inherits the unchanged wildcard `Allow: /`. Search and training controls remain independent.
- Fixed canonical and Open Graph URLs to use `https://www.hq360.space`, matching the live 308 redirect from the apex domain. Updated `.env.example` and normalised old HQ360 apex environment values so they cannot reintroduce this mismatch.
- Added a dynamic XML sitemap covering **58 current canonical pages**, including all services, industries, insights, guides, answers and published verified projects. It excludes legacy redirects, admin/API routes and sample projects. Published project changes are picked up automatically; no invented modification dates are emitted. Database outages return a retryable 503 rather than advertising a partial sitemap.
- Changed legacy redirects to permanent 301s. Known `/services/:slug` URLs now redirect to the matching service, and nonexistent service slugs return 404 instead of all redirecting to the directory.
- Moved published project detail loading into server functions used by route loaders. Project text, title, canonical and sample `noindex` now agree in the initial HTML. The work directory also receives published projects during SSR, retaining its browser filters and refresh. Successful missing/unpublished lookups return real 404s; temporary data failures use existing bundled content where available and errors elsewhere.
- Kept admin/API/error responses out of indexes with `X-Robots-Tag: noindex`. Existing admin meta directives remain intact. These directives are indexing controls, not access controls.
- Replaced the FAQ widget with native disclosure elements: the same answers are present in server HTML and open without JavaScript. Scroll-reveal content is visible in SSR and when JavaScript is unavailable; animation is added after hydration for below-fold content.
- Added a useful general `/faqs` page and footer link, with links to services, industries and contact. Its answers derive from existing `capabilities.ts`, `industries.ts`, `process.ts`, Contact and Insights content. Clarified the homepage and five service summaries; aligned service titles with visible offerings. No new testimonials, metrics, locations, prices or promises were added.
- Added the missing H1 on Book Launch and corrected the work listing's heading level. Removed the obsolete “domain/contact placeholders” note from Contact; the domain is already live and the existing contact details remain unchanged.
- Enhanced the existing Organization data with a stable identifier, supplied logo and existing social profiles. Modelled industry and capability offerings as `Service` linked to that Organization instead of representing each industry as a separate local business. FAQ structured answers match server-rendered visible answers. JSON-LD serialization escapes HTML delimiters.
- Reduced the displayed wordmark from 316,278 to **24,538 bytes** (about 92% smaller), using resized lossless WebP with explicit dimensions; original artwork is retained. Served the same Inter and Space Grotesk fonts locally with their licenses and Latin font preloads. Added actual Nitro/Vercel caching rules because Vercel does not consume `public/_headers`.
- Corrected the homepage's invalid tab semantics while retaining its interactive service/industry selectors. Fixed two existing TypeScript issues, existing formatting errors and lint traversal of generated build files. Enabled Nitro for production preview so `bun run preview` serves the Vercel build correctly.

## Validation completed

- `bun run build`: passed, producing `.vercel/output`.
- `bunx tsc --noEmit`: passed.
- `bun run lint`: passed with six existing React Fast Refresh warnings and no errors.
- `bun run audit:seo http://127.0.0.1:4175`: passed against the production preview. Checks 58 indexable pages and three sample pages, metadata uniqueness, canonical URLs, H1s, XML content type, JSON-LD parsing, SSR FAQ answers, training/search robots separation, published project coverage, noindex samples, 404s, redirects and internal links.
- The initial full crawl checked 157 unique internal destinations/anchors with no broken targets. The integration audit checked 3,809 internal link occurrences across indexable and sample pages. Instagram, Twitter/X and TikTok URLs each returned 200 (Twitter redirects to X); this checks public reachability, not account ownership.
- Chrome checks at 390px and 1440px on Home, SEO service, FAQs, a published project and Contact: no horizontal overflow or page JavaScript errors. FAQ controls worked. Client navigation from Work to a project returned its correct heading and title. JavaScript-disabled checks confirmed readable reveal content and usable FAQs. No inquiry/newsletter forms were submitted.

Mobile Lighthouse, one run per environment with default mobile throttling:

| Metric | Existing live website | Updated local production bundle |
| --- | ---: | ---: |
| Performance | 52 | 69 |
| Accessibility | 95 | 100 |
| SEO | 100 | 100 |
| First contentful paint | 4.2 s | 2.7 s |
| Largest contentful paint | 6.6 s | 4.8 s |
| Cumulative layout shift | 0.170 | 0.000 |

These are **lab measurements, not field Core Web Vitals**. The updated bundle was served locally with gzip, while the baseline used Vercel; network, CDN and origin latency differ. The comparison is directional, not a promised production improvement. The local LCP remains above the 2.5-second good threshold. Recheck on production and prioritise remaining render delay, initial JavaScript and animation cost if field data confirms the issue. Lighthouse's SEO score alone did not detect the original missing sitemap or canonical mismatch.

## Hosting and firewall findings

Live production requests on the audit date:

- `https://www.hq360.space/`: 200, HTML, no `X-Robots-Tag` exclusion.
- `https://hq360.space/`: 308 to the www host.
- `/robots.txt`: 200, broad crawl allowance; no GPTBot-specific rule.
- `/sitemap.xml`: 404 before these changes are deployed.
- Requests using Googlebot, Bingbot, OAI-SearchBot, GPTBot and ChatGPT-User user agents: 200 from this machine.

Fetched OpenAI's [official searchbot IP feed](https://openai.com/searchbot.json): **35 IPv4 prefixes**, feed creation time `2026-01-02T11:00:00.000000`. The exact snapshot is [openai-searchbot-ranges-2026-09-10.json](./openai-searchbot-ranges-2026-09-10.json). Refresh before configuring a rule; do not treat the snapshot as a permanent allowlist.

No repository firewall rule was found that denies those ranges or bot names. Account-level Vercel firewall configuration and request logs were not available, so **source-IP access is not verified**. A request that merely uses a crawler's name cannot prove it is allowed from that crawler's real IP space.

## Steps for the owner after review

1. **Deploy this build.** Keep Vercel's apex-to-www HTTPS redirect. Set both `SITE_URL` and `VITE_SITE_URL` to `https://www.hq360.space`; keep the existing Supabase host/build secrets in place. The sitemap and published-work SSR need the database connection. Re-run `bun run audit:seo https://www.hq360.space` after deployment.
2. **Review Vercel Firewall → Bot Management and custom rules.** Ensure OAI-SearchBot is allowed on public pages. Check AI-bot rules, IP/geographic restrictions, challenges, rate limits and production deployment protection against the latest official searchbot ranges. Prefer verified bot identity; do not allow traffic solely because it claims a user-agent. Inspect real requests for 403, 429 or challenge responses and verify their source IPs against the feed. Preserve GPTBot's separate current setting. Do not broadly disable the firewall or bypass admin/API protections. Run `bun scripts/check-search-access.ts` for the latest ranges and public probes.
3. **Google Search Console:** verify the `hq360.space` Domain property using Google's supplied DNS token; submit `https://www.hq360.space/sitemap.xml`. Use URL Inspection → Test live URL on Home, a service, an industry and published Work. Confirm www is the selected canonical and rendered content is present, then request indexing for those changed pages. Check Page Indexing, Crawl Stats and Core Web Vitals for remaining issues. No verification token was invented or added.
4. **Bing Webmaster Tools:** verify the site or import the verified Google property, submit the same sitemap, and inspect representative URLs with URL Inspection/Live URL. Monitor crawl/index errors after processing. IndexNow is an optional future addition for frequent publishing, not required for the current sitemap implementation.
5. **Recheck mobile production performance** with PageSpeed Insights and Search Console field data. The logo/font fixes and layout improvements are implemented; further performance work should be guided by the deployed measurements. Confirm contact and social details as part of normal business-content maintenance.

No ranking, indexing, rich-result or AI-citation guarantee is implied. Google's AI features use the same indexing and SEO foundations; no special AI file or special schema is required. FAQ markup here describes the content and does not promise FAQ search presentation.

## Official documentation consulted

- [OpenAI crawler controls and published IP feeds](https://developers.openai.com/api/docs/bots)
- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Vercel Bot Management](https://vercel.com/docs/bot-management) and [custom WAF rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)
- [Bing sitemaps](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed) and [URL Inspection](https://www.bing.com/webmasters/help/url-inspection-55a30305)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) and [server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
- [Nitro configuration](https://nitro.build/config)
