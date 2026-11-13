alter table public.payment_invoices
  drop constraint payment_invoices_bank_currency_check;
alter table public.payment_invoices
  add constraint payment_invoices_bank_currency_check check (
    provider <> 'bank_transfer' or
    (environment = 'live' and currency in ('USD', 'EUR'))
  );

alter table public.expert_invoice_requests
  drop constraint expert_invoice_requests_currency_method_check;
alter table public.expert_invoice_requests
  add constraint expert_invoice_requests_currency_method_check check (
    payment_type = 'bank_transfer' or currency = 'USD'
  );
