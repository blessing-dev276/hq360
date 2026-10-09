-- Invoice values can remain USD while this EUR-only bank receives an agreed EUR amount.
alter table public.payment_invoices
  add column bank_transfer_amount_minor bigint;
alter table public.payment_invoices
  drop constraint payment_invoices_bank_currency_check;
alter table public.payment_invoices
  add constraint payment_invoices_bank_currency_check check (
    provider <> 'bank_transfer' or (
      environment = 'live' and currency in ('USD', 'EUR') and
      (currency = 'EUR' or (bank_transfer_amount_minor is not null and bank_transfer_amount_minor > 0))
    )
  );
alter table public.payment_invoices
  add constraint payment_invoices_bank_amount_check check (
    bank_transfer_amount_minor is null or
    (provider = 'bank_transfer' and bank_transfer_amount_minor > 0 and bank_transfer_amount_minor <= 10000000000)
  );
alter table public.expert_invoice_requests
  add column currency text not null default 'USD' check (currency in ('USD', 'EUR')),
  add column bank_transfer_amount_minor bigint;
alter table public.expert_invoice_requests
  add constraint expert_invoice_requests_bank_amount_check check (
    bank_transfer_amount_minor is null or
    (payment_type = 'bank_transfer' and bank_transfer_amount_minor > 0 and bank_transfer_amount_minor <= 10000000000)
  );

alter table public.expert_invoice_requests
  add constraint expert_invoice_requests_currency_method_check check (
    (payment_type = 'bank_transfer' or currency = 'USD') and
    (payment_type <> 'bank_transfer' or currency = 'EUR' or bank_transfer_amount_minor is not null)
  );
