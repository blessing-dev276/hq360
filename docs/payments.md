# HQ360 admin and Remita payments

The `/admin` workspace contains Overview, Payments, Work & portfolio, Team, Testimonials and Author audits. Existing content tools retain their APIs. Scout opens from the sidebar.

## Enable payments

1. Apply `supabase/migrations/20260923090000_payment_invoices.sql` to the intended Supabase project using your usual migration process. It creates private, service-role-only invoice storage. No browser Supabase access is granted.
2. Set these **server-only** environment variables on your host (see `.env.example`): `REMITA_ENVIRONMENT=demo`, `REMITA_MERCHANT_ID`, `REMITA_SERVICE_TYPE_ID`, `REMITA_API_KEY`, `REMITA_PUBLIC_KEY`. The public checkout key is returned only where required; the API key never leaves the server. Obtain credentials for the Collections/RRR API and inline checkout from Remita. No sample merchant credentials are hardcoded.
3. For invoice emails, configure the existing Resend integration: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and an approved `EMAIL_FROM`. Set `SITE_URL` to the public HTTPS origin. Without email configuration, issued invoice links can still be copied and shared.
4. Deploy, then use `/admin#payments`: create draft → review → issue with Remita → send invoice or copy link. Issuing creates the RRR; emailing is an explicit, separate action. Email failures do not mark the invoice sent or discard it.
5. Test a complete demo payment and confirm status in both the Remita portal and HQ360. Complete Remita's required UAT before setting `REMITA_ENVIRONMENT=live` and replacing all four credentials with the matching live values. Demo and live invoices are stored separately and the dashboard shows the current environment only.

The migration, remote configuration and live merchant acceptance test are deployment steps; local tests do not perform them.

## Buyer flow and verification

Buyers open `/pay/<random-token>`, review the invoice, and pay through Remita's hosted inline widget. The page supports printing and clearly labels demo invoices. The link acts as a bearer credential: share it only with the intended buyer. The public API excludes buyer email/phone and admin identifiers, sends no-store/noindex headers, and the payment page uses a no-referrer policy. Marketing page chrome and lead widgets are excluded.

The browser success event triggers a server-to-server status lookup; it never marks an invoice paid directly. A paid result requires a successful Remita status (`00`), matching RRR, and matching exact invoice amount. If provided, order ID and currency must match too. If your Remita contract's status response omits `amount`, confirm the appropriate reconciliation endpoint with Remita before go-live; this integration intentionally refuses to mark incomplete responses paid.

Status is refreshed after checkout, through the buyer's **I've paid — check status** button, and through the admin's **Check payment** action. Checks are throttled per invoice in the database. This version does not register a Remita webhook or run background settlement polling: bank/offline payments require a status check. Pending invoices remain payable after their due date; “overdue” is a reporting label.

Creation uses a client-generated idempotency ID. RRR issuance uses that persisted order ID and a database claim to prevent concurrent issuance. If a response is lost, retry **the same invoice**: duplicate/already-existing order responses (`027`, `028`, `055`) attempts to recover the RRR via order status. If recovery is unavailable, reconcile the order with Remita before creating any replacement. Once issued, invoice amounts and references cannot be edited through these APIs. A verified paid state is never downgraded.

The dashboard and CSV export include up to the latest 1,000 invoices in the active environment. Revenue cards show collected invoice amounts, not merchant settlement balances or fees. Monetary values are stored as integer kobo and presented in NGN. Other currencies, taxes, refunds, recurring invoices and automatic reminders are outside this implementation.

## Verification

- `bun test tests/payments.test.ts tests/payments-database.test.ts` tests signatures, reference recovery, money validation, payment verification, same-origin checks and database restrictions.
- `bun run build` builds the production application.
- Start `bun run preview --port 8081` after building, then `bun scripts/test-payments-browser.mjs` to exercise the admin and buyer flow at desktop/mobile sizes using isolated API and checkout fixtures. It creates no real records, sends no email and performs no real transaction. Screenshots are written to `/tmp/hq360-*.png`.

Implementation references: [Remita's RRR generation/status SDK](https://github.com/RemitaPaymentServices/remita-rrr-generator-status-python), [Remita inline RRR SDK](https://github.com/RemitaPaymentServices/remita-inline-sdk-rrr-flutter), [SystemSpecs response codes](https://www.postman.com/systemspecs/systemspecs-s-public-workspace/documentation/itulel5/processing-firs-transactions), and [Remita developer portal](https://devs.remita.net/). Confirm merchant-specific response fields and enabled payment channels during UAT.
