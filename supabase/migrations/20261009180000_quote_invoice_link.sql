-- Keep one invoice or invoice request per quote, with the selected package recorded.
-- Existing invoice amounts remain a snapshot even if the quote changes later.
alter table public.payment_invoices
  add column source_quote_id uuid references public.price_quotes(id),
  add column source_package_index integer check (source_package_index >= 0 and source_package_index < 4);
create unique index payment_invoices_source_quote_unique
  on public.payment_invoices(source_quote_id) where source_quote_id is not null;
alter table public.expert_invoice_requests drop constraint expert_invoice_requests_payment_type_check;
alter table public.expert_invoice_requests add constraint expert_invoice_requests_payment_type_check
  check (payment_type in ('card', 'crypto', 'bank_transfer'));
alter table public.expert_invoice_requests
  add column source_quote_id uuid references public.price_quotes(id),
  add column source_package_index integer check (source_package_index >= 0 and source_package_index < 4);
create unique index expert_invoice_requests_source_quote_unique
  on public.expert_invoice_requests(source_quote_id) where source_quote_id is not null;
