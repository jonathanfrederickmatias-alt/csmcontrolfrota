DROP POLICY IF EXISTS "Public can update maintenance_requests for QR" ON public.maintenance_requests;
CREATE POLICY "Public can update maintenance_requests for QR" ON public.maintenance_requests FOR UPDATE TO anon
USING (status IN ('open','in_progress') AND tenant_id IS NOT NULL)
WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.equipments e WHERE e.id = maintenance_requests.equipment_id AND e.tenant_id = maintenance_requests.tenant_id));

DROP POLICY IF EXISTS "Public can update work_orders for QR" ON public.work_orders;
CREATE POLICY "Public can update work_orders for QR" ON public.work_orders FOR UPDATE TO anon
USING (status IN ('open','in_progress'))
WITH CHECK ((tenant_id = (SELECT w.tenant_id FROM work_orders w WHERE w.id = work_orders.id)) AND (equipment_id = (SELECT w.equipment_id FROM work_orders w WHERE w.id = work_orders.id)) AND (os_number = (SELECT w.os_number FROM work_orders w WHERE w.id = work_orders.id)) AND (maintenance_request_id = (SELECT w.maintenance_request_id FROM work_orders w WHERE w.id = work_orders.id)));

DROP POLICY IF EXISTS "Public can read work_orders_maintenance_history parts" ON public.work_orders;

DROP POLICY IF EXISTS "Authenticated users read reports" ON storage.objects;
CREATE POLICY "Managers read reports" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reports' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')));

DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
CREATE POLICY "Owners or managers delete photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'photos' AND (owner_id = (select auth.uid()::text) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')));