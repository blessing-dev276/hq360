> Follow-up: [agency-refresh.md](agency-refresh.md) describes the local multi-service refresh. This document records the preceding author-platform rollout; its sales, report and payment systems remain in place.

# Author platform rollout

## Readiness review

The repository contains working inquiry capture, an optional CRM webhook, Scout prospect records, evidence/review controls for private reports, invoicing, and published portfolio/testimonial feeds. Bundled assets and seed scripts include author review screenshots, testimonial videos, launch footage and a book interior formatting sample. These are reused without inventing client results. The four offers reuse existing writing, design, website, email and visibility capabilities; actual capacity, turnaround and price must be confirmed when scoping each proposal.

The initial implementation did not inspect live inquiries, analytics, contact records or financial records. During the authorised rollout, schema metadata and aggregate counts were inspected, and the migration copied existing source records into the private lead tracker. Delivery capacity, publication permissions for new samples, creator demand and detailed-report pricing are business checks still required before expanding promotion. Creator and other industry pages remain reachable but are not promoted in the main navigation.

## Public structure

The four author offers live at `/services/book-writing-editing`, `/services/book-formatting-publishing`, `/services/author-visibility-marketing`, and `/services/author-websites-email`. The homepage follows the author journey, published work, free-check preview, project process, testimonials/team and inquiry form. `/authors` is an overview; `/book-launch` remains the focused launch offer.

`/resources` brings together the existing guides, answers, glossary, downloads, articles and tools. `/insights` shares the hub with a `/resources` canonical. Deep article URLs remain intact. `/about` includes the team; the existing `/team` page remains available with an About canonical. `/capabilities` and `/results` retain their existing redirects to Services and Our Work. `/reviews` now points to the closest matching testimonial collection. Blog's existing redirect points to Resources. Review traffic and backlinks before retiring any further URLs. Legacy service detail pages remain available.

The Free Author Visibility Check is a request for an initial human-reviewed assessment, not instant automated research. The Detailed Author Visibility Report is separately scoped and priced, with evidence, uncertainty, actions and existing human-review controls. No price or delivery time has been invented.

## Activate the workflow

Apply `supabase/migrations/20260930100000_sales_workflow.sql` and `supabase/migrations/20260930110000_nowpayments_only.sql` through the normal Supabase deployment process before deploying the new admin UI. It creates private `sales_leads` and `sales_events` tables, grants access to the service role, backfills existing inquiries/visibility requests/non-excluded Scout prospects and captures future submissions with database triggers. Existing source records and payment behavior are preserved. Do not run seed scripts as part of this rollout.

Admin now groups daily work under Leads & Follow-ups, Scout, Audit, Projects, Invoices and Website Content. The first and Projects views share the same record. Projects shows records with an active project status or a won sales stage. Use:

1. Review the source material and assign a team member.
2. Mark qualified, then record introductions and discussions with contact/follow-up dates.
3. Add a reviewed report URL and an externally prepared proposal URL. The tracker does not generate or send proposals.
4. Agree the service and scope, create an invoice in Invoices, then explicitly link it to this record. No automatic matching by email.
5. Track delivery, client review and ongoing support. Record a check completion date only when a reviewed visibility check has actually been delivered.

Scout exclusions close their related lead and clear follow-ups. The admin API refuses to reactivate an excluded Scout prospect. Creating/updating a lead never sends an outreach message.

The existing `LEAD_WEBHOOK_URL` connection receives inquiries, visibility requests and later sales-record updates, with optional existing secret/auth header settings. Configure CRM upserts using `recordKey` (`inquiry:<source id>`, `visibility_check:<source id>`, `scout:<source id>`, or `manual:<lead id>`). This key remains stable across initial capture and later updates; do not key updates only by event kind. Updates include the current workflow fields. A failed or unconfigured webhook does not lose the stored lead, and the admin save notice exposes forwarding status. Automatic retries and two-way CRM sync are not implemented; re-save to retry forwarding.

## Measurement and verification

Consent-aware GA events: `project_inquiry_submitted` and `visibility_check_submitted`; neither includes personal information. Operational counts use stored records: delivered checks with completion dates; distinct leads that reached qualified/proposal stages; and projects linked to paid live invoices. Historical inquiries are backfilled, but historical stage transitions cannot be reconstructed. Counts are cumulative, not a time-window funnel; a paid invoice does not automatically mark delivery complete.

Run `bunx tsc --noEmit`, `bun run lint`, `bun run build`, and `bun test tests/sales-workflow.test.ts`. Browser verification: start `bun run preview --port 8081`, then `bun scripts/test-author-workflow-browser.mjs`. Browser fixtures intercept writable APIs so tests do not submit real inquiries, CRM updates, emails or payments.

The full existing `bun test` suite currently has two test-loading failures outside this change: `tests/scout.test.ts` imports the absent `scout/sources/public-pages/parse` module, `tests/scout-transport.test.ts` imports the absent `scout/transport.server` module. The new sales tests pass. The development server also encounters a native `@resvg` dependency-optimization error; production build/preview works and is used for browser verification. The payment test import was corrected as part of the NOWPayments-only change.

Type-checking and lint for the changed files pass. The full repository lint command also reports existing formatting errors in untouched author-report, capability and migration-script files (26 errors and 7 warnings); these were not swept into this change.

## Payment provider restriction

NOWPayments is the only active payment provider. New invoice validation, issuance, payment checks, checkout links, admin setup and buyer actions all enforce this choice. The Paystack webhook returns HTTP 410 without processing events. Historical provider records remain stored; the new database trigger rejects non-NOWPayments invoice creation or issuance changes. Existing hosted checkout URLs at third-party providers are not remotely cancelled by this change.

## Production database rollout — 30 September 2026

Linked project: `ihvccuqytxrxnqectivg`. The payment schema already matched migrations `20260923090000`, `20260923100000` and `20260924090000`, but the history entries were missing. After checking columns, defaults, constraints, indexes and access controls, those versions were recorded as applied rather than replayed. The sales-workflow and NOWPayments-only migrations were then applied successfully. The unshipped Paystack-enablement migration was removed; Paystack was never enabled by this rollout.
