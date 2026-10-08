-- Proposals: long-form, branded service proposals sent to a client by secret
-- link (/proposal/<token>), PDF, or email. Separate from price quotes.
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- 'hq360' for the admin team, or the expert's profile id.
  owner text not null,
  title text not null default '' check (char_length(title) <= 200),
  client_name text not null default '' check (char_length(client_name) <= 160),
  client_email text not null default '' check (char_length(client_email) <= 254),
  -- e.g. "Author of Snippets of a Vet's Life"
  subtitle text not null default '' check (char_length(subtitle) <= 300),
  -- [{ label, value }] shown on the cover, e.g. Campaign duration: 90 days.
  details jsonb not null default '[]'::jsonb check (jsonb_typeof(details) = 'array'),
  -- The proposal itself, in simple formatting (headings, lists, tables).
  body text not null default '' check (char_length(body) <= 100000),
  prepared_by text not null default 'HQ360' check (char_length(prepared_by) <= 160),
  prepared_by_role text not null default '' check (char_length(prepared_by_role) <= 160),
  footer_note text not null default '' check (char_length(footer_note) <= 600),
  sent_at timestamptz,
  sent_to text,
  views integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_owner_idx on public.proposals (owner, updated_at desc);
alter table public.proposals enable row level security;
revoke all on public.proposals from anon, authenticated;
grant all on public.proposals to service_role;

create or replace function public.proposal_viewed(p_token text) returns void
language sql security definer set search_path = public as $$
  update proposals set views = views + 1, last_viewed_at = now() where token = p_token;
$$;
revoke all on function public.proposal_viewed(text) from public, anon, authenticated;
grant execute on function public.proposal_viewed(text) to service_role;
