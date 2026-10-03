-- One-to-one outreach emails from the admin to authors.
--
-- Sent through a dedicated outreach sender (e.g. hello@mail.hq360.space) so
-- cold-outreach reputation never affects invoice/client email. Every send is
-- logged, and anyone who unsubscribes is suppressed permanently.

create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_by text not null,
  to_email text not null check (char_length(to_email) <= 254),
  to_name text check (char_length(to_name) <= 160),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  template text not null check (template in ('letter', 'card')),
  scout_prospect_id uuid references public.scout_prospects(id) on delete set null,
  status text not null check (status in ('sent', 'failed')),
  provider_id text,
  error text
);
create index outreach_messages_email_idx on public.outreach_messages (lower(to_email), created_at desc);
create index outreach_messages_created_idx on public.outreach_messages (created_at desc);

-- Addresses that must never receive outreach (unsubscribed or blocked).
create table public.outreach_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null default 'unsubscribed' check (reason in ('unsubscribed', 'manual', 'bounced', 'complained')),
  created_at timestamptz not null default now()
);

alter table public.outreach_messages enable row level security;
alter table public.outreach_suppressions enable row level security;
revoke all on public.outreach_messages, public.outreach_suppressions from anon, authenticated;
grant all on public.outreach_messages, public.outreach_suppressions to service_role;
