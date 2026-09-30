-- Preserve historical provider records, but only NOWPayments may create or issue invoices.
alter table public.payment_invoices alter column provider set default 'nowpayments';
create function public.enforce_active_payment_provider() returns trigger language plpgsql set search_path = public as $$
begin
  if new.provider <> 'nowpayments' then
    if tg_op = 'INSERT' then
      raise exception 'NOWPayments is the only active payment provider';
    elsif new.provider is distinct from old.provider
       or new.provider_invoice_id is distinct from old.provider_invoice_id
       or new.checkout_url is distinct from old.checkout_url then
      raise exception 'NOWPayments is the only active payment provider';
    end if;
  end if;
  return new;
end $$;
create trigger enforce_active_payment_provider before insert or update on public.payment_invoices
for each row execute function public.enforce_active_payment_provider();
revoke all on function public.enforce_active_payment_provider() from public;
