
GRANT SELECT, UPDATE ON public.maintenance_requests TO anon;

CREATE POLICY "Public can read maintenance_requests for QR"
ON public.maintenance_requests FOR SELECT TO anon USING (true);

CREATE POLICY "Public can update maintenance_requests for QR"
ON public.maintenance_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);
