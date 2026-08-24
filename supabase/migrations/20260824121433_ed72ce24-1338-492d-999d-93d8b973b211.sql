ALTER TABLE public.maintenance_history
  ADD COLUMN IF NOT EXISTS photos_start jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photos_end jsonb NOT NULL DEFAULT '[]'::jsonb;