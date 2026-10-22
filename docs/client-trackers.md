# Client tracking, AI updates, auto portfolio and academy content

Implements `HQ360-Expert-Dashboard-Spec.pdf` (v1.0, 20 Oct 2026) in the Expert
dashboard. Code lives in `src/lib/trackers/`, `src/lib/academy/content.ts`,
`src/components/expert/{ClientTrackers,AiSettings,TrackerPortfolioDrafts}.tsx`,
`src/components/academy/ContentPlaybook.tsx` and `src/routes/track.$slug.tsx`.

## Release steps

1. `bun install` (adds `bcryptjs`; refreshes `bun.lock`).
2. Apply the migrations in order:
   - `20261020090000_client_trackers.sql`: phase 1 (trackers, lockout, views, templates, private `tracker-files` bucket, academy content and versions)
   - `20261020090100_academy_daily_lessons_seed.sql`: the 11 daily lessons from Author Playbook chapter 26
   - `20261020100000_expert_ai_keys.sql`: phase 2
   - `20261020110000_tracker_auto_portfolio.sql`: phase 3
   - `20261022090000_tracker_admin_access.sql`: admin access (admin key, admin templates, admin approvals)
3. Set `AI_KEY_MASTER_KEY` (see `.env.example`) before any expert saves a key.
4. `bun test tests/trackers-*.test.ts`, `bun run lint`, `bun run build` (the build regenerates `src/routeTree.gen.ts` for the new routes).
5. Hugh migration, below.

## Hugh Murphy migration (spec section 7)

```sh
unzip hugh-tracker-site.zip -d /tmp/hugh   # use the copy that contains gfx-1..4-q7.png
HUGH_PASSCODE='<Hugh's current passcode>' bun --env-file=.env scripts/seed-hugh-tracker.ts \
  --expert-email <Emmanuel's expert login> --files /tmp/hugh
```

- Creates `hq360.space/track/hugh-murphy-7k2q`, uploads the 8 files, adds the log, and publishes. Overall progress should print 25%.
- The passcode is read from the environment and stored only as a bcrypt hash. Passcodes are compared ignoring case, spaces and hyphens, so the hyphenated and unhyphenated forms the spec uses both open the page.
- Not carried over automatically: the website preview link on "Premium personal author website" and the Goodreads list URLs. The spec doesn't give them and the old page content is encrypted. Add them in the editor (button block, list links).
- Old link: in the `hugh-progress` Cloudflare Pages project, replace the site with a `_redirects` file containing `/* https://hq360.space/track/hugh-murphy-7k2q 301`.

## Security rules and where they are enforced

| Rule | Enforcement |
|---|---|
| Passcodes only as a slow hash | bcrypt cost 12 (`security.server.ts`); a DB `CHECK` rejects anything that isn't a bcrypt hash |
| Passcode never readable | Shown once on create or reset; `passcode_hash` is never selected for the dashboard |
| 30 day sign in | HMAC-signed cookie bound to tracker and passcode version (reset signs out all devices) |
| 5 wrong tries, 15 minute lock | `tracker_record_attempt` / `tracker_lock_until` (atomic, per visitor HMAC, not IP) |
| noindex, short lived files | `X-Robots-Tag: noindex, nofollow` and a meta tag; files leave the private bucket only as 10 minute signed links, and only if they are on the published page |
| No raw IPs | Daily rotating HMAC visitor hash; a DB `CHECK` rejects non-hash values |
| API keys encrypted, never to the browser | AES-256-GCM bound to the expert id; GET returns provider and last four only; provider calls are server side, with the key in a header |
| Expert's key only for their trackers | `runAiAction` checks tracker ownership before loading the expert's own key; there is no fallback key |
| AI only drafts | AI writes only to `tracker_ai_drafts`; a person approves (into the working copy), then publishes |
| No invented figures | Prompt rules, plus a check that rejects any number or quote not in the expert's input |
| Portfolio needs consent | DB trigger refuses entries without consent and a Complete, Portfolio ready item; withdrawing consent, archiving, reopening or deleting removes entries immediately; media goes through a proxy that rechecks consent on every request |

## Admin access

Admin has every expert feature, in the admin panel:

- **Client tracking** (`/admin#trackers`): every expert's trackers, with an Expert column. Admin can open, edit, publish, reset passcodes, archive and delete any tracker. A new tracker always belongs to an approved expert, whom admin picks; that expert stays the client's contact and gets the view notifications. Admin has its own templates.
- **Portfolio entries from trackers** (same page): admin sees and approves every expert's drafts. Consent rules still apply. Auto publish stays each expert's own setting.
- **Settings, AI** (`/admin#trackerAi`): admin's own key in `admin_ai_credentials`, encrypted the same way. Admin's AI drafts use only that key, never an expert's. Usage rows and approvals are recorded as admin.
- **Academy content**: already available under Admin → Academy → Trainer tools → Playbook content.

The admin panel calls the same APIs with the header `x-hq360-actor: admin`. The server accepts it only with a valid admin session (`trackerActor` in `src/lib/trackers/actor.server.ts`).
