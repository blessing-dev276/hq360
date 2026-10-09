-- Buyer proof is private evidence, never a payment confirmation by itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bank-transfer-receipts', 'bank-transfer-receipts', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.bank_transfer_receipts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.payment_invoices(id),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  bank_reference text,
  admin_note text check (char_length(admin_note) <= 500)
);
create unique index bank_transfer_receipts_one_open on public.bank_transfer_receipts(invoice_id)
  where status = 'submitted';
create index bank_transfer_receipts_invoice_idx on public.bank_transfer_receipts(invoice_id, submitted_at desc);
alter table public.bank_transfer_receipts enable row level security;
revoke all on public.bank_transfer_receipts from anon, authenticated;
grant all on public.bank_transfer_receipts to service_role;

create or replace function public.approve_bank_transfer_receipt(p_receipt_id uuid, p_bank_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_invoice_id uuid;
begin
  if length(trim(coalesce(p_bank_reference, ''))) < 3 or length(p_bank_reference) > 200 then
    raise exception 'Enter a valid bank transaction reference';
  end if;
  select invoice_id into v_invoice_id from bank_transfer_receipts
    where id = p_receipt_id and status = 'submitted' for update;
  if v_invoice_id is null then raise exception 'Receipt is no longer awaiting review'; end if;
  update payment_invoices set status = 'paid', paid_at = now(),
    payment_id = trim(p_bank_reference), provider_status = 'receipt_confirmed_by_admin'
    where id = v_invoice_id and provider = 'bank_transfer' and status = 'pending';
  if not found then raise exception 'Invoice is no longer awaiting payment'; end if;
  update bank_transfer_receipts set status = 'approved', reviewed_at = now(),
    bank_reference = trim(p_bank_reference) where id = p_receipt_id;
  return v_invoice_id;
end $$;
revoke all on function public.approve_bank_transfer_receipt(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_bank_transfer_receipt(uuid, text) to service_role;
