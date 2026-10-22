-- Private ledger: record each outreach before contacting the email provider.
create table public.author_outreach (
  id uuid primary key,
  fingerprint text not null unique,
  recipient text not null,
  subject text not null,
  content text not null,
  sender_name text not null,
  from_address text not null,
  reply_to text not null,
  html text not null,
  plain_text text not null,
  source text not null default 'composer' check (source in ('composer','resend_import')),
  is_test boolean not null default false,
  send_status text not null default 'pending' check (send_status in ('pending', 'accepted', 'unconfirmed')),
  provider_id text unique,
  delivery_status text,
  checked_at timestamptz,
  workflow text not null default 'awaiting_reply' check (workflow in ('awaiting_reply','replied','interested','follow_up','closed','opted_out')),
  notes text not null default '',
  follow_up_on date,
  created_at timestamptz not null default now()
);
create index author_outreach_created_idx on public.author_outreach(created_at desc, id desc);
create index author_outreach_recipient_idx on public.author_outreach(recipient);
alter table public.author_outreach enable row level security;
revoke all on public.author_outreach from anon, authenticated;
grant all on public.author_outreach to service_role;
