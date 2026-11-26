CREATE OR REPLACE FUNCTION public.qr_header(_name text) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json ->> _name, '')
$$;

DROP POLICY IF EXISTS "Public can read maintenance_history for QR" ON public.maintenance_history;
CREATE POLICY "QR reads history of scanned equipment" ON public.maintenance_history FOR SELECT TO anon
USING (equipment_id::text = public.qr_header('x-qr-equipment'));

DROP POLICY IF EXISTS "Public can read work_orders for QR" ON public.work_orders;
CREATE POLICY "QR reads OS of scanned equipment or OS" ON public.work_orders FOR SELECT TO anon
USING (equipment_id::text = public.qr_header('x-qr-equipment') OR id::text = public.qr_header('x-qr-os'));

DROP POLICY IF EXISTS "Public can update work_orders for QR" ON public.work_orders;
CREATE POLICY "QR updates scanned open OS" ON public.work_orders FOR UPDATE TO anon
USING (id::text = public.qr_header('x-qr-os') AND status IN ('open','in_progress'))
WITH CHECK (id::text = public.qr_header('x-qr-os') AND (tenant_id = (SELECT w.tenant_id FROM work_orders w WHERE w.id = work_orders.id)) AND (equipment_id = (SELECT w.equipment_id FROM work_orders w WHERE w.id = work_orders.id)) AND (os_number = (SELECT w.os_number FROM work_orders w WHERE w.id = work_orders.id)) AND (maintenance_request_id = (SELECT w.maintenance_request_id FROM work_orders w WHERE w.id = work_orders.id)));

DROP POLICY IF EXISTS "Public can read maintenance_requests for QR" ON public.maintenance_requests;
CREATE POLICY "QR reads requests of scanned equipment or OS" ON public.maintenance_requests FOR SELECT TO anon
USING (equipment_id::text = public.qr_header('x-qr-equipment')
  OR id IN (SELECT w.maintenance_request_id FROM public.work_orders w WHERE w.id::text = public.qr_header('x-qr-os')));

DROP POLICY IF EXISTS "Public can update maintenance_requests for QR" ON public.maintenance_requests;
CREATE POLICY "QR updates open requests of scanned equipment or OS" ON public.maintenance_requests FOR UPDATE TO anon
USING (status IN ('open','in_progress') AND (equipment_id::text = public.qr_header('x-qr-equipment')
  OR id IN (SELECT w.maintenance_request_id FROM public.work_orders w WHERE w.id::text = public.qr_header('x-qr-os'))))
WITH CHECK (equipment_id::text = public.qr_header('x-qr-equipment')
  OR id IN (SELECT w.maintenance_request_id FROM public.work_orders w WHERE w.id::text = public.qr_header('x-qr-os')));