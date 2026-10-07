# Audit workflow upgrade

Extend author_audits, audit_findings, audit_evidence_assets and existing private
client versions/access/sessions. Existing audits retain their legacy workspace.
New audits use workflow_version=1 and a research → import → review → generated
snapshot → QA → publish sequence. Imports and client snapshots are immutable.

Implementation: schema/access; reusable editable prompt and strict import
validation; normalized review cards/sections/Listopia/actions/evidence; private
client snapshot rendering; publish/access/version controls; workflow tests.

Admin manages assignments and publishes. Assigned reviewers approve content;
assigned experts prepare content. Old mutation APIs cannot bypass this workflow.
No import can set approval, visibility, access codes or publication state.

## Verification and operation

- Migration: `20261002230000_audit_research_workflow.sql` extends the existing
  audit tables and adds immutable imports, assignments, review queues, private
  evidence, and revision-aware publication RPCs.
- Unit/database checks: `bun test tests/audit-workflow.test.ts`. These exercise
  JSON normalization/validation, review gates, immutable imports/snapshots,
  stale-revision rejection, publication QA and anonymous access restrictions.
- Live browser check (against a locally running production preview):
  `RUN_AUDIT_LIVE_TEST=1 AUDIT_TEST_URL=http://127.0.0.1:8089 node --env-file=.env scripts/test-audit-workflow-browser.mjs`.
  Requires Node 24 and configured Supabase credentials. The opt-in test creates
  isolated fixtures and removes its own audit, evidence, author/book and test
  account in cleanup. It does not send client messages. Node is required because
  Bun's HTTP compatibility layer mishandles Playwright response cookie URLs.
- New reports use browser printing; the legacy PDF/image exporters do not accept
  the new report payload. Section ordering uses accessible arrow controls.
- Application deployment is a separate step from applying the database migration.

Latest validation: all seven unit/database tests passed (28 assertions), and the
live browser test passed creation through private publication, access-code
rotation, draft isolation, revised publication, Expert/Reviewer restrictions and
mobile layout. The production build passed. Lint has no errors (eight existing
warnings). Repository-wide type checking remains blocked by the existing typed
route error in `src/components/site/PricingCards.tsx:57`.

## AI web research

The Research tab now has **Search web with AI**. It searches five author/book
angles through the configured SerpAPI connection, adds Google Books and Open
Library catalogue metadata, and gives Claude only that collected source bundle
and the audit's reusable prompt. The button imports a valid generated draft in
one action. Findings remain unapproved; source links and excerpts are archived
for staff review. Generated claims without a collected citation are excluded, existing findings
are skipped, and the original AI response is retained in the immutable import archive.
If the output fails schema validation, the editable JSON and specific errors
are shown instead of importing it. The optional search focus narrows the query;
`AUDIT_AI_MODEL` selects the server-side model (default `claude-sonnet-5`).
Public search snippets are treated as leads, not verified live-page metrics.

## Simplified workspace

The default workspace now follows three steps: Research → Review → Publish.
Existing audits open on their findings; successful AI research also moves directly
into review. Findings, actions, Goodreads lists, evidence and checks are grouped
under Review. Section configuration, assignments and activity history are reached
through Settings & history. Manual research imports and prompt customization are
collapsed, as are the detailed preview/version/QA controls on Publish. The existing
server validation, permissions and publication operations remain authoritative.

## Distribution, author depth and approval fixes — October 7, 2026

AI research now runs 27 targeted searches (plus an optional focus), including
individual print/ebook/audiobook retailers, subscription and library catalogues,
author biography, book publication history, and separate author/book award
searches. The source bundle balances searches rather than truncating later
queries; it retains up to 80 sources. Generation instructions require format,
edition, territory and availability distinctions, and exact award attribution.
Search snippets remain leads, not proof of live stock or award verification.
These requirements are appended to AI runs even when a saved prompt is older.
Existing reports require another research/review cycle to gain new findings.

Approve/Reject now sends only the record ID and review decision, using the saved
record on the server instead of resubmitting all content through editor validation.
Nullable screenshot dates/captions/sources are accepted by the editor. Incomplete
screenshot approval identifies missing caption, proof, source or capture date.
The publication completeness checks remain in place.

Validation: targeted unit/database checks plus
`RUN_AUDIT_LIVE_TEST=1 bun scripts/test-audit-approvals.ts` exercise approval and
rejection persistence for all five reviewable entity types against isolated live
fixtures. This script removes its own fixtures and does not publish or message
clients.
