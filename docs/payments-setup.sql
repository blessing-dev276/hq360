-- Run once in the Supabase SQL Editor for this project.
-- This setup is for a database without public.payment_invoices.
-- Source: the payment migrations listed below.
BEGIN;

-- 20260923090000_payment_invoices.sql
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

-- 20260923100000_nowpayments.sql
-- Preserve existing Remita invoices; all new invoices use NOWPayments.
alter table public.payment_invoices
  add column provider text not null default 'remita' check (provider in ('remita', 'nowpayments')),
  add column provider_invoice_id text,
  add column checkout_url text,
  add column payment_id text,
  add column provider_status text;
alter table public.payment_invoices alter column provider set default 'nowpayments';
-- Only empty drafts are transferable. Issued historical invoices keep their provider.
update public.payment_invoices set provider = 'nowpayments' where status = 'draft' and rrr is null and issue_locked_at is null;
-- Replace the original unnamed reference constraint without assuming its generated name.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.payment_invoices'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%rrr IS NOT NULL%'
  loop execute format('alter table public.payment_invoices drop constraint %I', c.conname); end loop;
end $$;
alter table public.payment_invoices drop constraint payment_invoices_status_check;
alter table public.payment_invoices add constraint payment_invoices_status_check check (status in ('draft', 'pending', 'paid', 'refunded'));
alter table public.payment_invoices add constraint payment_invoices_provider_reference_check check (
  status = 'draft' or (provider = 'remita' and rrr is not null) or
  (provider = 'nowpayments' and provider_invoice_id is not null and checkout_url is not null)
);
create unique index payment_invoices_provider_id_idx on public.payment_invoices(provider, environment, provider_invoice_id) where provider_invoice_id is not null;

-- 20260924090000_invoice_usd.sql
-- Keep historical amounts in their original currency; all new invoices use USD.
alter table public.payment_invoices drop constraint payment_invoices_currency_check;
alter table public.payment_invoices add constraint payment_invoices_currency_check check (currency in ('NGN', 'USD'));
alter table public.payment_invoices alter column currency set default 'USD';

NOTIFY pgrst, 'reload schema';
COMMIT;
