-- Grant table permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_requests TO authenticated;
GRANT INSERT ON public.maintenance_requests TO anon;
GRANT SELECT ON public.equipments TO anon;