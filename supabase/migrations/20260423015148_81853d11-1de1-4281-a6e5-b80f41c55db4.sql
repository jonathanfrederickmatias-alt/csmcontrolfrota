ALTER TABLE public.equipments
ADD COLUMN IF NOT EXISTS cost_per_hour numeric NOT NULL DEFAULT 0;