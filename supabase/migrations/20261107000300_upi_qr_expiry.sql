ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Give existing unpaid orders a fresh five-minute QR window on rollout.
UPDATE public.payment_orders
SET expires_at = now() + interval '5 minutes'
WHERE status = 'pending'
  AND amount > 0
  AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS payment_orders_expiry_idx
  ON public.payment_orders(expires_at)
  WHERE status = 'pending';
