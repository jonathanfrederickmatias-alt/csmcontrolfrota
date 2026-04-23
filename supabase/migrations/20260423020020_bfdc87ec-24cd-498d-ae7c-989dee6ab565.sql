DROP POLICY IF EXISTS "Authenticated users can manage fuel_price_settings" ON public.fuel_price_settings;

CREATE POLICY "Authenticated users can view fuel_price_settings"
ON public.fuel_price_settings
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert fuel_price_settings"
ON public.fuel_price_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update fuel_price_settings"
ON public.fuel_price_settings
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete fuel_price_settings"
ON public.fuel_price_settings
FOR DELETE
TO authenticated
USING (auth.role() = 'authenticated');