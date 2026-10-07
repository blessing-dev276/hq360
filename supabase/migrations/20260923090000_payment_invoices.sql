create sequence if not exists public.payment_invoice_number_seq;
create table public.payment_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('HQ-' || lpad(nextval('public.payment_invoice_number_seq')::text, 6, '0')),
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text not null,
  description text not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 10000000000),
  currency text not null default 'NGN' check (currency = 'NGN'),
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'paid')),
  rrr text unique,
  payment_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  environment text not null check (environment in ('demo', 'live')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  checked_at timestamptz,
  issue_locked_at timestamptz,
  check (status = 'draft' or rrr is not null),
  check (status <> 'paid' or paid_at is not null)
);
create index payment_invoices_created_idx on public.payment_invoices(created_at desc);
alter table public.payment_invoices enable row level security;
revoke all on public.payment_invoices from anon, authenticated;
revoke all on sequence public.payment_invoice_number_seq from anon, authenticated;
grant all on public.payment_invoices to service_role;
grant usage, select on sequence public.payment_invoice_number_seq to service_role;
