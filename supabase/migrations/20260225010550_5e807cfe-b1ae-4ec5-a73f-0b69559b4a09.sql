
-- Add parts array column to work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS parts jsonb NOT NULL DEFAULT '[]'::jsonb;
