# HQ360 invoices with NOWPayments

The admin dashboard creates USD-priced invoices and sends buyers to NOWPayments hosted checkout to choose a cryptocurrency and network. API keys and the IPN signing secret stay on the server. No provider JavaScript SDK or wallet credentials are loaded into the browser.

## Setup

1. Apply the existing `20260923090000_payment_invoices.sql` migration if it is not already applied, followed by `20260923100000_nowpayments.sql`. Then apply `20260924090000_invoice_usd.sql` to enable USD for new invoices without changing historical amounts. The second migration preserves issued Remita records and marks them as historical; they are excluded from the NOWPayments dashboard and payment endpoints. Unissued, unlocked drafts are transferred. Do not edit or rerun the original migration on an existing database.
2. Create a NOWPayments account, configure the receiving wallet and accepted assets, and obtain an API key and an IPN secret from the matching environment's dashboard.
3. Set these **server-only** values (see `.env.example`):
   - `NOWPAYMENTS_ENVIRONMENT=demo` for sandbox; `live` for production.
   - `NOWPAYMENTS_API_KEY`
   - `NOWPAYMENTS_IPN_SECRET`
   - `SITE_URL` — the public HTTPS origin of this deployment.
4. The application supplies `${SITE_URL}/api/payments/nowpayments/ipn` as `ipn_callback_url` when creating each hosted invoice. Ensure this endpoint is publicly reachable, without login middleware or a proxy challenge. Configure notification retries in NOWPayments. The site validates `x-nowpayments-sig` using recursively sorted JSON and HMAC-SHA512, then retrieves the payment through the authenticated API before saving its status.
5. Invoice email delivery uses the existing `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and verified `EMAIL_FROM`. Without email configuration, copy and share the buyer link instead.
6. Deploy and test sandbox invoice creation, the hosted checkout, notifications, full/partial payments, and return links before changing to live credentials. Confirm NOWPayments accepts `usd` price quotes and your invoice amount exceeds its current minimum for the selected asset. The app does not silently convert currencies or change invoice amounts.

The default API hosts are `https://api-sandbox.nowpayments.io/v1` and `https://api.nowpayments.io/v1`. Demo and live records are kept separate. Previous `REMITA_*` values are no longer used and can be removed from the host environment. No live provider credentials or database deployment are performed by the local tests.

## Workflow

Create a draft at `/admin#payments`, review it, choose **Issue with NOWPayments**, then **Send invoice** or **Copy link**. Emailing is a separate explicit action. Buyers open `/pay/<random-token>`, review/print their invoice and follow the hosted checkout link. The payment link is a bearer credential; share it only with the intended buyer. Buyer APIs omit email/phone, disable caching and indexing, and use a no-referrer policy.

The provider invoice ID is different from a payment ID. NOWPayments creates a payment when a buyer chooses a currency. The signed notification supplies that payment ID; the app retrieves its status and verifies its order ID, invoice ID, USD price and amount. Only `finished` with `actually_paid >= pay_amount` marks an invoice paid. A redirect or unsigned browser claim never confirms payment. Pending, confirming, confirmed, sending, expired, failed and partially paid transactions do not count as revenue. Their provider status appears on the invoice. Underpayments remain unpaid even if the merchant's provider settings tolerate them; resolve those cases in the provider dashboard. Multiple partial payments are not summed locally.

Signed notifications update the dashboard automatically. Buyers and admins can also check an already-notified payment manually. Before the first notification has bound a payment ID, a manual check returns the locally stored pending state; it does not guess a payment ID or use the invoice ID in the payment-status endpoint. Check provider notification delivery if a payment remains pending. A verified refund for the payment that settled the invoice changes it to refunded; delayed pending/finished events cannot resurrect a refunded invoice. Partial-refund accounting and refund initiation are not implemented.

Issuance takes a durable database claim. The API has no assumed idempotency guarantee: an uncertain timeout, 5xx or failed reference save keeps the claim locked to prevent accidental duplicate invoices. Definitive provider rejections release it. For an uncertain request, find the order using its UUID in NOWPayments and reconcile its invoice ID and checkout URL into the same record through a trusted database operation; only clear the claim for retry after confirming no invoice was created. This recovery is deliberately not automatic.

The dashboard and CSV cover the latest 1,000 NOWPayments invoices in the current environment. New invoice amounts are integer US cents, and revenue represents invoice value rather than crypto balances, fees or wallet settlement proceeds. Due dates are reporting labels, not provider payment-expiry settings.

## Verification

- `bun test tests/payments.test.ts tests/payments-database.test.ts`
- `bun run build`
- `bun run preview --port 8081`, followed by `bun scripts/test-payments-browser.mjs` for the mocked desktop/mobile admin and buyer flow. This sends no email and creates no provider transactions.

References: [NOWPayments integration guide](https://nowpayments.io/blog/nowpayments-api-explained-customize-your-payment-gateway), [official SDK and signature rules](https://github.com/NowPaymentsIO/nowpayments-sdk-nodejs), [API endpoint documentation](https://nowpayments.zendesk.com/hc/en-us/articles/21345824322717-API-and-endpoint-description), and [sandbox guide](https://nowpayments.io/blog/how-to-use-the-sandbox-a-guide).

## Provider migration history

The `20260930110000` migration made NOWPayments the only active provider at that point. Later migrations add Flutterwave and direct EUR bank transfers. Apply `20260930110000_nowpayments_only.sql` after the existing migrations to enforce this for database writes as well as the application. Historical Remita/Paystack rows are preserved, but those providers cannot create invoices, issue checkout links or receive payment callbacks in HQ360. The retired Paystack webhook returns HTTP 410.

## Direct EUR bank transfers

Apply `20261009120000_bank_transfer_invoices.sql` after the Flutterwave and cancellation migrations, then deploy the application. Bank transfer is an additional active method and the default selection for new admin invoices. It requires no payment gateway credentials; email still requires the existing email configuration.

Choose **Bank transfer**, enter the USD invoice amount and the separately agreed EUR transfer amount, save and issue the invoice, then use **Send invoice** or **Copy link**. Emails and printable buyer invoices include the supplied Clear Junction account details, the invoice number as payment reference, and the account holder's receiving restrictions: EUR only, SEPA or SEPA Instant from EEA banks. The SWIFT/BIC is shown as an account identifier, not an offered wire-transfer method. Existing invoices keep their original currency and amount.

Transfers remain pending until an authenticated admin checks the actual bank receipt and selects **Confirm bank receipt**, entering the bank transaction reference. Refreshing the buyer page never marks a payment paid. There is no bank feed or automated settlement verification. Record full receipt only; partial transfers remain pending. USD and EUR dashboard totals are separate. Cancelling an invoice hides payment instructions but cannot prevent someone transferring to previously shared bank details.

Verification: `bun test tests/bank-transfer.test.ts tests/payments.test.ts tests/payments-database.test.ts`. After building and starting preview on port 8081, run `bun scripts/test-bank-transfer-browser.mjs` for mocked desktop, mobile, print, pending-status and cancellation checks.

## Convert a quote to an invoice

Apply `20261009180000_quote_invoice_link.sql` after the bank transfer migration. Open a saved quote in Sales → Quotes, save any pending changes, then choose **Create invoice**. Select the buyer's agreed package (for example, Premium), provide the buyer's email and invoice due date (phone is optional), and submit. The invoice amount and description are read from the saved package on the server. USD quotes can use hosted checkout or an agreed EUR bank transfer amount while the invoice total stays in USD. EUR quotes use direct SEPA bank transfer. For a USD bank invoice, enter the exact EUR transfer amount agreed with the buyer; the app does not calculate an exchange rate. NGN and GBP quotes cannot be converted until the buyer agrees on a supported currency and the quote is updated.

Admins receive a draft in Payments to review, issue and send. Experts receive an invoice request for admin review; they can track it in Invoice requests. Creation never sends an invoice automatically. A quote can have one linked invoice or request, so repeating the action returns the existing record. The selected package index and source quote remain linked for tracing, while invoice details are a snapshot of the quote at creation. For staged payment terms, create the required deposit and balance invoices separately; this conversion currently creates one invoice for the selected package's full price.

Apply `20261009190000_bank_usd_settlement.sql` after the quote link migration for USD invoices settled into the EUR account. The buyer invoice and email show the USD invoice total and a separate agreed EUR transfer amount. Buyer phone is optional; Flutterwave receives it only when supplied.


## Buyer bank transfer screenshots

Apply `20261009200000_bank_transfer_receipts.sql`. A buyer with an issued, pending bank invoice can upload a PNG, JPEG or WebP screenshot up to 4 MB from the invoice page. The private storage bucket keeps screenshots out of public URLs. Only one screenshot can await review at a time, and the buyer can resubmit after rejection (up to three submissions). Uploads do not mark invoices paid.

The upload emails the HQ360 inbox, configured admin notification addresses and founder with the screenshot attached and a secure review link. It also creates an in-app admin notification, so a failed email does not hide the submission. Admin or the founder signs in, opens the review link, checks the bank account for the full EUR amount, and enters the bank transaction reference before confirming. Rejection keeps the invoice pending. The screenshot and review action are not available through the public invoice API.
