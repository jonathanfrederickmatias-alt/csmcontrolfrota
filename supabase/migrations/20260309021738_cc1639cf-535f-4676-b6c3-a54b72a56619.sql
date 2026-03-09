-- Drop the restrictive public insert policy and recreate as permissive
DROP POLICY IF EXISTS "Public can insert maintenance_requests" ON public.maintenance_requests;

CREATE POLICY "Public can insert maintenance_requests"
ON public.maintenance_requests
FOR INSERT TO anon, authenticated
WITH CHECK (true);