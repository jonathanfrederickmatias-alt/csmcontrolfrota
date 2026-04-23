CREATE TABLE IF NOT EXISTS public.fuel_price_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type TEXT NOT NULL UNIQUE,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_price_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage fuel_price_settings"
ON public.fuel_price_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_fuel_price_settings_updated_at
BEFORE UPDATE ON public.fuel_price_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.fuel_price_settings (fuel_type, unit_price)
VALUES
  ('diesel', 0),
  ('diesel_s10', 0),
  ('gasolina', 0),
  ('etanol', 0),
  ('arla', 0)
ON CONFLICT (fuel_type) DO NOTHING;