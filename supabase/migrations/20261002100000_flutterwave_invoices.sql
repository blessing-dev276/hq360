-- Flutterwave joins NOWPayments as a second active invoice provider (card/bank,
-- alongside NOWPayments' crypto checkout). Experts can also request an invoice
-- for their own client; admin reviews the request and turns it into a real
-- invoice, which stays linked back to the requesting expert for transparency.

-- Replace both check constraints without assuming their generated names.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.payment_invoices'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%remita%' and pg_get_constraintdef(oid) like '%nowpayments%'
    and pg_get_constraintdef(oid) not like '%provider_invoice_id%'
  loop execute format('alter table public.payment_invoices drop constraint %I', c.conname); end loop;
end $$;
alter table public.payment_invoices
  add constraint payment_invoices_provider_check
    check (provider in ('remita', 'nowpayments', 'flutterwave'));

alter table public.payment_invoices
  drop constraint if exists payment_invoices_provider_reference_check;
alter table public.payment_invoices
  add constraint payment_invoices_provider_reference_check check (
    status = 'draft'
    or (provider = 'remita' and rrr is not null)
    or (provider in ('nowpayments', 'flutterwave') and provider_invoice_id is not null and checkout_url is not null)
  );

create or replace function public.enforce_active_payment_provider() returns trigger language plpgsql set search_path = public as $$
begin
  if new.provider not in ('nowpayments', 'flutterwave') then
    if tg_op = 'INSERT' then
      raise exception 'NOWPayments and Flutterwave are the only active payment providers';
    elsif new.provider is distinct from old.provider
       or new.provider_invoice_id is distinct from old.provider_invoice_id
       or new.checkout_url is distinct from old.checkout_url then
      raise exception 'NOWPayments and Flutterwave are the only active payment providers';
    end if;
  end if;
  return new;
end $$;

alter table public.payment_invoices
  add column requested_by_expert_id uuid references public.expert_profiles(id) on delete set null;

create table public.expert_invoice_requests (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.expert_profiles(id) on delete cascade,
  buyer_name text not null check (char_length(buyer_name) <= 150),
  buyer_email text not null check (char_length(buyer_email) <= 254),
  buyer_phone text not null check (char_length(buyer_phone) <= 25),
  description text not null check (char_length(description) <= 1000),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 10000000000),
  due_date date not null,
  payment_type text not null check (payment_type in ('card', 'crypto')),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'declined')),
  admin_note text check (char_length(admin_note) <= 1000),
  invoice_id uuid references public.payment_invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index expert_invoice_requests_expert_id_idx on public.expert_invoice_requests(expert_id);
alter table public.expert_invoice_requests enable row level security;
revoke all on public.expert_invoice_requests from anon, authenticated;
grant all on public.expert_invoice_requests to service_role;
