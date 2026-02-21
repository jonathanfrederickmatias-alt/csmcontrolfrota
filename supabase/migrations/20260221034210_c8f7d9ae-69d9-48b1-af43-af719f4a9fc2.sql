
-- Create obras table
CREATE TABLE public.obras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage obras"
ON public.obras FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can read obras"
ON public.obras FOR SELECT
TO anon
USING (true);

-- Add obra_id to equipments (nullable for backward compat)
ALTER TABLE public.equipments ADD COLUMN obra_id uuid REFERENCES public.obras(id);

-- Trigger for updated_at on obras
CREATE TRIGGER update_obras_updated_at
BEFORE UPDATE ON public.obras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create maintenance_history table for persistent records per machine
CREATE TABLE public.maintenance_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id uuid NOT NULL REFERENCES public.equipments(id),
  plan_id uuid REFERENCES public.maintenance_plans(id),
  description text NOT NULL,
  hour_meter numeric NOT NULL DEFAULT 0,
  executed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  operator_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage maintenance_history"
ON public.maintenance_history FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
