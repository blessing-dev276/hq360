-- 50% to start, 50% on delivery: a split creates two linked invoices, a
-- deposit and a balance, each showing the full project price.
alter table public.payment_invoices
  add column installment text not null default 'full'
    check (installment in ('full', 'deposit', 'balance')),
  add column installment_group uuid,
  add column project_total_minor bigint check (project_total_minor is null or project_total_minor > 0);
create index payment_invoices_installment_group_idx
  on public.payment_invoices (installment_group) where installment_group is not null;
