-- Direct EUR transfers coexist with existing hosted invoices without converting amounts.
alter table public.payment_invoices drop constraint payment_invoices_provider_check;
alter table public.payment_invoices add constraint payment_invoices_provider_check
  check (provider in ('remita', 'nowpayments', 'flutterwave', 'bank_transfer'));
alter table public.payment_invoices drop constraint payment_invoices_currency_check;
alter table public.payment_invoices add constraint payment_invoices_currency_check
  check (currency in ('NGN', 'USD', 'EUR'));
alter table public.payment_invoices add constraint payment_invoices_bank_currency_check
  check (provider <> 'bank_transfer' or (currency = 'EUR' and environment = 'live'));
alter table public.payment_invoices drop constraint payment_invoices_provider_reference_check;
alter table public.payment_invoices add constraint payment_invoices_provider_reference_check check (
  status = 'draft'
  or (provider = 'remita' and rrr is not null)
  or (provider = 'bank_transfer' and provider_invoice_id is not null and provider_invoice_id = number)
  or (provider in ('nowpayments', 'flutterwave') and provider_invoice_id is not null and checkout_url is not null)
);
alter table public.payment_invoices add constraint payment_invoices_bank_receipt_check
  check (provider <> 'bank_transfer' or status <> 'paid' or
    (payment_id is not null and length(trim(payment_id)) >= 3 and provider_status is not null and provider_status = 'receipt_confirmed_by_admin'));
create or replace function public.enforce_active_payment_provider() returns trigger language plpgsql set search_path = public as $$
begin
  if new.provider not in ('nowpayments', 'flutterwave', 'bank_transfer') then
    if tg_op = 'INSERT' then
      raise exception 'Unsupported payment provider';
    elsif new.provider is distinct from old.provider
       or new.provider_invoice_id is distinct from old.provider_invoice_id
       or new.checkout_url is distinct from old.checkout_url then
      raise exception 'Unsupported payment provider';
    end if;
  end if;
  return new;
end $$;
