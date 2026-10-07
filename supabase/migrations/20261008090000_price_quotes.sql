-- Price quotes: branded pricing pages experts (with the "quotes" tool) and
-- admins build for a buyer, shared by secret link and exportable as PDF/PNG.
create table public.price_quotes (
  id uuid primary key default gen_random_uuid(),
  -- Unguessable public link token (/quote/<token>).
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- 'hq360' for the admin team, or the expert's profile id.
  owner text not null,
  prepared_by text not null default 'HQ360' check (char_length(prepared_by) <= 160),
  client_name text not null default '' check (char_length(client_name) <= 160),
  project_title text not null default '' check (char_length(project_title) <= 200),
  intro text not null default '' check (char_length(intro) <= 1500),
  currency text not null default 'USD' check (currency in ('USD', 'NGN', 'GBP', 'EUR')),
  -- [{ name, price, delivery, features: string[], recommended }], price in major units.
  packages jsonb not null default '[]'::jsonb check (jsonb_typeof(packages) = 'array'),
  notes text not null default '' check (char_length(notes) <= 2000),
  valid_until date,
  views integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index price_quotes_owner_idx on public.price_quotes (owner, updated_at desc);
alter table public.price_quotes enable row level security;
revoke all on public.price_quotes from anon, authenticated;
grant all on public.price_quotes to service_role;

-- Count a public view without a read-modify-write race.
create or replace function public.price_quote_viewed(p_token text) returns void
language sql security definer set search_path = public as $$
  update price_quotes set views = views + 1, last_viewed_at = now() where token = p_token;
$$;
revoke all on function public.price_quote_viewed(text) from public, anon, authenticated;
grant execute on function public.price_quote_viewed(text) to service_role;
