ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS photos_start jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photos_end jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill arrays from legacy single-URL columns when present
UPDATE public.work_orders
SET photos_start = jsonb_build_array(photo_start_url)
WHERE photo_start_url IS NOT NULL
  AND photo_start_url <> ''
  AND (photos_start IS NULL OR jsonb_array_length(photos_start) = 0);

UPDATE public.work_orders
SET photos_end = jsonb_build_array(photo_end_url)
WHERE photo_end_url IS NOT NULL
  AND photo_end_url <> ''
  AND (photos_end IS NULL OR jsonb_array_length(photos_end) = 0);