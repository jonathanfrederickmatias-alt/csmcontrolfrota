
ALTER TABLE public.maintenance_plans
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'horimetro',
  ADD COLUMN IF NOT EXISTS interval_days integer,
  ADD COLUMN IF NOT EXISTS last_done_date timestamptz,
  ADD COLUMN IF NOT EXISTS next_due_date timestamptz;

ALTER TABLE public.maintenance_plans
  DROP CONSTRAINT IF EXISTS maintenance_plans_plan_type_check;
ALTER TABLE public.maintenance_plans
  ADD CONSTRAINT maintenance_plans_plan_type_check CHECK (plan_type IN ('km','horimetro','tempo'));

ALTER TABLE public.maintenance_plans ALTER COLUMN interval_hours DROP NOT NULL;
ALTER TABLE public.maintenance_plans ALTER COLUMN next_due_at DROP NOT NULL;
ALTER TABLE public.maintenance_plans ALTER COLUMN last_done_at DROP NOT NULL;
