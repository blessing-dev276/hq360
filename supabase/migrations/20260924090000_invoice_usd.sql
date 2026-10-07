-- Keep historical amounts in their original currency; all new invoices use USD.
alter table public.payment_invoices drop constraint payment_invoices_currency_check;
alter table public.payment_invoices add constraint payment_invoices_currency_check check (currency in ('NGN', 'USD'));
alter table public.payment_invoices alter column currency set default 'USD';
