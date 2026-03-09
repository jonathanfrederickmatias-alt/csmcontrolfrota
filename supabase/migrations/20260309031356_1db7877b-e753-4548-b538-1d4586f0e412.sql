-- Fix: Recreate policies as PERMISSIVE (default) instead of RESTRICTIVE
DROP POLICY IF EXISTS "Public can insert maintenance_requests" ON public.maintenance_requests;
DROP POLICY IF EXISTS "Authenticated users can manage maintenance_requests" ON public.maintenance_requests;

CREATE POLICY "Authenticated users can manage maintenance_requests"
  ON public.maintenance_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can insert maintenance_requests"
  ON public.maintenance_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);