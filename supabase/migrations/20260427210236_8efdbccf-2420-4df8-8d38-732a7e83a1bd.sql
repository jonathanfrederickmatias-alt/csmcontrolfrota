CREATE POLICY "Public can read maintenance_history for QR"
ON public.maintenance_history
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Public can read work_orders_maintenance_history parts"
ON public.work_orders
FOR SELECT
TO anon
USING (true);