-- Who the buyer sees as the sender of an invoice: an HQ360 expert, or HQ360
-- itself when null. Defaults to the expert who requested the invoice.
ALTER TABLE public.payment_invoices
  ADD COLUMN sender_expert_id uuid REFERENCES public.expert_profiles(id) ON DELETE SET NULL;
UPDATE public.payment_invoices SET sender_expert_id = requested_by_expert_id
  WHERE sender_expert_id IS NULL AND requested_by_expert_id IS NOT NULL;
