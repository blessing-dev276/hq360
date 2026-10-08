# Evidence-led audit recommendations and proposals

The existing TanStack Start / React / Supabase research workflow remains in place.
Research is hybrid: AI web research and JSON imports are schema-validated; staff can
edit and approve findings; client reports use immutable reviewed snapshots.

## Main changes

- `src/lib/author-audit/services.ts`: 21 stable services, eligibility/evidence rules,
  proposed deliverables, dependencies, complexity, KPIs, exclusions and configurable
  bundles. No invented prices, partnerships or results. Defaults require a quote.
- `src/lib/author-audit/commercial.ts`: schema extensions, conservative legacy
  adapter, integrity checks, per-finding matches, grouped opportunities, roadmap
  phases and proposal drafts. A fit score indicates rule strength, not expected
  campaign performance. All matches require eligibility confirmation.
- `src/lib/author-audit/commercial.server.ts`: authenticated settings, evidence
  mappings, objectives, editable proposals and private client inquiries.
- `AuditCommercialAdmin.tsx`: Audit → Review → HQ360 opportunities. Admins control
  service availability, prices, bundle names/components/descriptions/prices,
  finding impacts, and proposal approval. Annotation changes return findings to
  review and do not rewrite original evidence.
- `AuditCommercialReport.tsx` and `ResearchAuditReport.tsx`: evidence-first finding
  details, strengths, conditional opportunities, grouped offers, dependencies,
  author-led actions, contextual inquiries and approved proposals. Existing
  navigation, branding, hidden-area choices and merged Listopia page are retained.
- `workflow.ts` / `workflow-ai-search.server.ts`: optional structured impacts,
  dates, evidence conditions and nullable metrics. Service conditions quote source
  excerpts; generated numerical metrics and condition excerpts are checked against
  collected text. Legacy research inputs remain valid without new fields.

## Storage and compatibility

Apply `20261008170000_admin_perplexity_credentials.sql` and
`20261008180000_audit_commercial.sql` before deploying code. The latter adds:

- nullable `audit_findings.commercial` JSON and an updated atomic import function;
- `audit_commercial_config`, a shared admin-managed configuration;
- `audit_service_matches`, individual finding/service mappings with evidence URLs;
- `audit_proposals`, an editable draft with revision, evidence/configuration
  revision and explicit approval/sharing state.

All new tables use RLS and deny browser database access. Admin configuration and
proposal APIs verify administrator identity and same-origin writes. Experts cannot
approve or share proposals. Mapping writes enforce audit ownership in a transaction.

Existing audit facts, raw imports, source URLs, retrieval dates and immutable
snapshots are not rewritten. New client recommendations are computed from the
current service configuration and the client's published snapshot, so disabling a
service removes its offer without mutating the underlying report. Old workflow
snapshots without commercial metadata use the conservative adapter. The separate
legacy (workflow version 0) report and PDF system remains available unchanged.

## Matching and integrity

Automatic legacy matches are deliberately narrow: cited awards/media assets,
page-scoped signup observations, Goodreads presence, specifically relevant list
pages, and evidenced reader-discussion opportunities. Other services need explicit
quoted evidence conditions. Merely naming a service or having a low Amazon rank
cannot produce an offer. Unknowns, uncited findings, rejected/hidden findings,
unsupported conditions and disabled services are excluded. Many findings can
support one offer. Bundles contain only supported components; partial bundles lose
any full-package price and require a fresh quote.

No text-pattern validator can establish the truth of an arbitrary external source.
These checks reject known invalid constructions and require cited/quoted evidence;
staff must still verify source relevance, rights, eligibility and conflicts in the
underlying evidence. Prerequisites are prominently shown rather than assumed met.

## Proposals and inquiries

Generate → edit → save → admin approve → separately share in the private audit.
Saving always resets approval and sharing. Optimistic revisions reject stale edits.
Changed audit evidence or global catalogue configuration requires a refreshed draft
and approval. Clients see only a shared proposal matching both their published audit
revision and the current audit/configuration. No email or client notification is
sent automatically. Publish the refreshed audit version before sharing a proposal
based on new findings or objectives.

Contextual inquiry buttons open a real validated form. The server requires the
private audit session, an enabled CTA, consent, valid contact fields and matching
service/finding references. It throttles requests and stores the inquiry in the
existing `project_inquiries` admin inbox. Errors never show a false success state.
No private access codes, report URLs, or evidence are forwarded to external CRM or
email services. No newsletter subscription is created.

## Ruth Foster regression

`tests/fixtures/ruth-foster-audit.json` is a sanitized copy of the existing reviewed
_A Perfect Year?_ report, read on 2026-10-08. Fixture identifiers replace record IDs;
evidence, source citations and 2026-10-07 retrieval dates remain verbatim. It retains
Ollerford Publishing, 17 October 2024 publication, the 2025 Comedy Women in Print
Self-Published Novel win, recorded Goodreads figures, retailer listings, media
recognition and annual-letter structure. No new findings or prices were invented.

The regression demonstrates award → media outreach, a relevant literary-mystery
list → conditional Listopia work, and homepage signup observation → reader magnet
scope. It excludes Amazon optimization from rank alone, audio production from
unknown availability, and backlist revival for a debut without performance data.
The live Ruth audit is not edited or republished by these tests.

## Verification

- `bun test tests/audit-commercial.test.ts tests/audit-commercial-database.test.ts`
- `bun test tests/audit-ai-search.test.ts tests/audit-approval.test.ts tests/audit-report-presentation.test.tsx tests/audit-workflow.test.ts`
- `bun scripts/test-audit-commercial-api.ts`
- `node scripts/test-audit-commercial-browser.mjs` with a preview at port 8091
  (or `BASE_URL`). All browser APIs are intercepted; no real messages or records.
- `bun scripts/test-audit-perplexity.ts`
- `bun scripts/test-expert-perplexity-settings.ts`
- TypeScript, changed-file ESLint and production build.

The browser regression covers desktop/mobile overflow, finding navigation,
inquiry error/retry/success, and proposal approval/editing. Database tests execute
migrations in PGlite and verify import preservation, mapping ownership/atomicity,
RLS grants and proposal approval constraints.
