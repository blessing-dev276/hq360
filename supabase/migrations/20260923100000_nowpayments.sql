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
