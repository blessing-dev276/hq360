-- Overdue (issued, unpaid) invoices can't be safely hard-deleted -- the
-- buyer's checkout link stays live at the provider, so deleting the row
-- would orphan any payment that lands after. "Cancelled" is the safe
-- equivalent: it stops the invoice being treated as collectible without
-- destroying the record a late webhook needs to reconcile against.
alter table public.payment_invoices
  drop constraint payment_invoices_status_check;
alter table public.payment_invoices
  add constraint payment_invoices_status_check
    check (status in ('draft', 'pending', 'paid', 'refunded', 'cancelled'));
