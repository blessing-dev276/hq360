# HQ360 agency refresh — local review

Implemented 30 September 2026. This supersedes the author-only public positioning in `author-platform-rollout.md`; the author sales/report infrastructure remains in place. No deployment, database migration, production content edits or outreach were performed for this refresh.

## Public route map

| Purpose                      | Canonical routes                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agency                       | `/`, `/services`, `/work`, `/about`, `/contact`                                                                                                                               |
| Core services                | `/services/website-development`, `/services/mobile-app-development`, `/services/automation-crm`, `/services/writing-editing`, `/services/translation-localization`            |
| Audiences                    | `/authors`, `/ugc-creators`, `/agencies`, `/cleaning-businesses`, `/appointment-based-businesses`, `/local-businesses`                                                        |
| Author offers, retained      | `/services/book-writing-editing`, `/services/book-formatting-publishing`, `/services/author-visibility-marketing`, `/services/author-websites-email`                          |
| Author launch and assessment | `/book-launch`, `/tools/author-visibility-audit`                                                                                                                              |
| Supporting hubs              | `/resources`, `/tools`, `/industries`                                                                                                                                         |
| Supporting content           | `/insights/:slug`, `/insights/guides/:slug`, `/insights/answers/:slug`, `/insights/glossary`, `/faqs`, `/testimonials`, `/work/:slug`, `/tools/:tool`, `/tools/website-audit` |
| Legal                        | `/privacy`, `/terms`                                                                                                                                                          |

Main navigation: Services (five core services), Who We Help (six audiences), Our Work, About, Start a Project. Logo links home. Resources and Tools remain in the footer. Private author access, `/admin`, `/scout`, `/pay/:token` and all APIs remain separate from public navigation.

The complete former author homepage now lives at `/authors`, including four offers, selected author work, check/report distinction, process, testimonials, team and inquiry. The previous authors page's launch link is retained. The generic homepage uses a separate component.

## New permanent redirects

| Old URL                         | Destination                     |
| ------------------------------- | ------------------------------- |
| `/creators`                     | `/ugc-creators`                 |
| `/local-business`               | `/local-businesses`             |
| `/team`                         | `/about#team`                   |
| `/services/websites-funnels`    | `/services/website-development` |
| `/services/crm-automation`      | `/services/automation-crm`      |
| `/services/writing-translation` | `/services/writing-editing`     |

Existing `/capabilities/:slug` redirects now go directly to the corresponding core destination for those three aliases. The old combined writing/translation service goes to writing/editing; translation now has its own distinct canonical page and is accessible through Services. Replaced paths are excluded from the sitemap; public category link destinations use the new canonical URLs. Legacy database category slugs are retained for compatibility.

## Existing route review

| Existing route or group                                                                                                                              | Decision and reason                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/authors`, `/book-launch`                                                                                                                           | Keep separate: full author journey versus specific launch scope.                                                                                                                                                                           |
| `/creators`, `/local-business`, `/agencies`                                                                                                          | Consolidate or refine into the new audience pages; keep useful website, presentation and follow-up themes. Agencies explicitly serves other delivery teams.                                                                                |
| `/team`                                                                                                                                              | Consolidate roster into About and redirect. Remove the separate page's unsupported in-house/account-manager claims from the public experience.                                                                                             |
| `/home-services`                                                                                                                                     | Keep off main navigation; broader trade content does not map exactly to cleaning. Review evidence and traffic before further consolidation.                                                                                                |
| `/plumbers`                                                                                                                                          | Keep off main navigation; emergency/contact needs differ from cleaning. Review evidence before active promotion.                                                                                                                           |
| `/roofers`                                                                                                                                           | Keep off main navigation; estimate and project content remains available.                                                                                                                                                                  |
| `/hvac`                                                                                                                                              | Keep off main navigation; seasonal/service content remains available.                                                                                                                                                                      |
| `/coaches`                                                                                                                                           | Keep off main navigation; coaching offers include needs beyond appointments. Review overlap and traffic before redirecting.                                                                                                                |
| `/med-spas`                                                                                                                                          | Keep off main navigation; avoid treating regulated/clinical intake as generic scheduling. Review specialist copy before promotion.                                                                                                         |
| `/real-estate`                                                                                                                                       | Keep off main navigation; an existing estate-surveyor website provides relevant evidence.                                                                                                                                                  |
| `/law-firms`                                                                                                                                         | Keep off main navigation; require evidence and specialist content review before promotion.                                                                                                                                                 |
| `/ecommerce`                                                                                                                                         | Keep off main navigation; retain existing store portfolio work.                                                                                                                                                                            |
| `/industries`                                                                                                                                        | Retain URL as the six-audience directory, linked from the audience menu.                                                                                                                                                                   |
| `/services/brand-creative`, `/services/content-social`, `/services/visibility-reputation`, `/services/lead-generation`, `/services/game-development` | Keep supporting legacy services off the core menu; useful author/creator context for creative and visibility services. Review delivery evidence before promoting lead generation or game development. No near-identical copies introduced. |
| `/capabilities`, `/capabilities/:slug`                                                                                                               | Existing redirects to Services retained, with direct canonical targets where consolidated.                                                                                                                                                 |
| `/results`                                                                                                                                           | Existing redirect to Our Work retained.                                                                                                                                                                                                    |
| `/reviews`                                                                                                                                           | Existing redirect to testimonials retained; genuine testimonials embedded where relevant.                                                                                                                                                  |
| `/blog`, `/blog/:slug`                                                                                                                               | Existing resource/article redirects retained.                                                                                                                                                                                              |
| `/insights`                                                                                                                                          | Existing Resources canonical retained; article, guide, answer and glossary URLs stay available.                                                                                                                                            |
| `/guarantee`                                                                                                                                         | Existing About redirect retained.                                                                                                                                                                                                          |
| `/faqs`, `/testimonials`, `/resources`, `/tools` and detail routes                                                                                   | Keep as supporting content, outside main navigation.                                                                                                                                                                                       |
| Private author/report, Scout, admin, payment and API routes                                                                                          | Preserve behavior and data; do not consolidate into marketing routes.                                                                                                                                                                      |

Traffic and search-console data were not available in the repository. No unrelated niche pages were retired or sent to the homepage. Their retention is not an endorsement of every legacy claim; review them against actual delivery evidence before renewed promotion.

## Inquiry and sales compatibility

- Visitors can choose multiple services and change the preselected business type. Only name/email are required; an empty service selection becomes “Help me choose.”
- Audience solution links carry audience, service and originating page through service pages and the header/footer CTAs to Contact.
- Existing `project_inquiries.industry` and `help_with` store chosen values. Existing `source_industry` stores origin audience; `source_path` retains origin page and original service query. No schema migration needed.
- Original service is encoded as `?service=<slug>` in `source_path`; old records containing plain paths remain valid. The lead dashboard displays the existing inquiry context when available and tolerates older/manual records without it.
- Persistence, sales trigger, email, CRM forwarding, proposal/report/invoice links and conversion tracking remain in place. Origin audience is also included in webhook fields. A successful stored response triggers inquiry conversion; clicks, validation failures, failed requests and honeypot responses do not.
- NOWPayments remains the only active payment provider. No payment behavior was changed.

## Proof and content still needed

Read-only review used existing bundled content and the public portfolio, case-study and team APIs. Published creator portfolios, author websites and Book Marketing Agency Pro support website examples. Book interior material is described as layout samples, not proof of translation. Published Goodreads campaigns are classified as author visibility, not CRM. Illustrative engagements incorrectly marked verified in published data are excluded from client proof and shown as sample content on their detail pages. Title/media deduplication prevents double-counting the same portfolio/case-study entry.

Please supply approved project contributions/screenshots or case studies for mobile apps, implemented CRM/automation, translation, cleaning businesses, appointment-based businesses and broader local-business workflows. Empty categories state that no matching published examples exist. Also needed: confirmed translation language pairs and review capacity; approved team biographies and relevant mobile/translation delivery roles; confirmation of any white-label offer before adding it. No languages, certifications, native-speaker credentials, white-label arrangements or missing clients/results are invented.

The public roster's existing names and titles take precedence over old bundled biographies. Missing bios remain blank, and first-name matching no longer assigns an unrelated person's bio or photo.

## Validation

- `bun run build`: passed. Existing large-chunk and TanStack `inputValidator` deprecation notices remain.
- `bunx tsc --noEmit`: passed.
- ESLint on every changed/new code and browser-test file: passed. `git diff --check`: passed.
- Relevant unit/database/security suites: **45 passed, 0 failed** across seven files. Includes agency context/proof/sitemap checks, sales workflow, payments/database, client access/security and Scout database tests.
- `scripts/test-agency-browser.mjs`: passed against the final local production preview. Covers all five services and six audiences; keyboard/dropdown/mobile navigation; footer/header inquiry origins; editable business type and multiple services; invalid, failed and successful submissions; success-only conversion; work filters/empty state; new redirects; mobile overflow.
- `scripts/test-author-workflow-browser.mjs`: passed. Four retained author offers, resources, inquiry submission, free visibility check, lead creation and project delivery.
- `scripts/test-payments-browser.mjs`: passed. Desktop/mobile admin, invoice draft, NOWPayments issuance, email action, payment verification and buyer checkout using fixtures; retired Paystack endpoint still returns 410.
- Desktop and mobile screenshots reviewed with existing published content. The mobile voice-message trigger is compact to reduce overlap with project CTAs; recording remains available. Reduced-motion preference used in agency browser checks.

All browser submissions and payment actions use intercepted APIs; no real email, lead submission, outreach or payment was sent. These verify interface behavior and existing database rules, not live email/CRM/provider delivery.

Unrelated repository failures, reported separately:

- Full `bun test`: 45 pass; two Scout suites fail to import missing `src/lib/scout/sources/public-pages/parse` and `src/lib/scout/transport.server`. These were already missing before this refresh.
- Full `bun run lint`: 17 existing formatting errors and seven existing warnings remain outside changed files (migration/review script, author-audit admin/publishing/API files, unused legacy About experience, and existing shared UI components). They were not expanded into this refresh.

To review locally: `bun run build`, then `bun run preview --port 8086`. Run browser scripts with `BASE_URL=http://localhost:8086` (agency/author) and `PAYMENTS_TEST_URL=http://localhost:8086` (payments). Restart preview after rebuilding to avoid serving stale server/assets. No push or deployment was performed.
