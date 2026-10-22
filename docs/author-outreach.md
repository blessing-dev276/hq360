# Author outreach

Open `/admin#outreach`. Enter one author's email, edit the subject and content,
and review the desktop/mobile preview. Blank lines create paragraphs;
`**Heading**: description` creates an orange-accented service section. The
signature and HQ360 author-services link are appended automatically. Paste the
message body without its original signature. Raw HTML is displayed as text.

Send a test to your own inbox, then choose Review email and Send to author.
Test emails are real emails sent to the test address. No email is sent merely
by editing or opening the preview.

## Server configuration

Use the existing `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM`
settings. Set `AUTHOR_EMAIL_REPLY_TO=ceo@hq360.space` for the monitored reply mailbox. All keys stay
on the server. Apply `supabase/migrations/20261013120000_author_outreach_history.sql` before deploying the history feature. The ledger is private to the server service role.

In Resend, verify the domain used by EMAIL_FROM with its supplied SPF and DKIM
records, and configure DMARC through your DNS provider. Disable open and click
tracking for this outreach domain. Test delivery with mailboxes you control
before contacting authors. Authentication and design do not guarantee inbox
placement. See https://resend.com/blog/top-10-email-deliverability-tips.

## Delivery and follow-up

Open **Outreach history** to search by recipient, filter by follow-up status or email
type, and browse every saved outreach. Each record includes the recipient, subject,
message, date, Resend reference, delivery status and your follow-up notes/date.

Choose **Check delivery** to fetch the latest status from Resend. This needs a
Resend API key with email read access. Delivery checks are manual, not webhook
updates. “Accepted” means the API accepted the send; “delivered” means the recipient's
mail server accepted it, not that it reached the inbox. Opens/clicks appear only if
Resend recorded those events; they are not reliable proof that a person read it.
The tool does not enable open/click tracking.

Choose **View / follow up** to record Replied, Interested, Follow up, Closed or
Opted out, add notes and set a follow-up date. These are manual records; no email
is scheduled and no mailbox is read. Monitor AUTHOR_EMAIL_REPLY_TO for replies.
An opted-out recipient, or one with a recorded bounce, complaint or suppression,
is blocked from future sends. Only remove an opt-out after renewed permission.

New messages are saved before sending; if history is unavailable, nothing is
sent. The ledger recognizes identical content/recipient/signature/type across
refreshes and retains the original Resend idempotency key and rendered payload.
Unconfirmed attempts older than 23 hours cannot be retried automatically because
Resend's idempotency retention is 24 hours. Check Resend before composing a
changed message after an uncertain result. This is not a bulk mailing tool.

## Historical import

`bun scripts/import-author-outreach.ts` previews the number of historical emails
matching the exact author-composer template. Add `--apply` to save them, without
sending anything. The importer examines messages since the composer's introduction
on 13 October 2026, excludes other templates, paginates Resend and leaves existing
records unchanged. Retention in Resend determines what remains available.

Older messages did not record whether they were tests. They are labeled
**Imported (type unverified)**, displayed under All emails or Imported emails,
and preserve their original content, timestamp and current delivery event.
New test emails are explicitly labeled and can be filtered separately.
