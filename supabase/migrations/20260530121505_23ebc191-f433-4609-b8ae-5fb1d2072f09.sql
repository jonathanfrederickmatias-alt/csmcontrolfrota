
-- 1) Drop public read on obras (contains client/CNPJ data; not needed for public QR flows)
DROP POLICY IF EXISTS "Public can read obras" ON public.obras;

-- 2) Drop full-table public read on tenants (exposes contact info). Branding is fetched via authenticated RPC.
DROP POLICY IF EXISTS "Public can read tenant branding" ON public.tenants;

-- 3) Tighten anon INSERT on checklists: tenant_id must match the equipment's tenant_id
DROP POLICY IF EXISTS "Public can insert checklists" ON public.checklists;
CREATE POLICY "Public can insert checklists"
ON public.checklists
FOR INSERT
TO anon
WITH CHECK (
  tenant_id IS NOT NULL
  AND equipment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.equipments e
    WHERE e.id = checklists.equipment_id AND e.tenant_id = checklists.tenant_id
  )
);

-- 4) Tighten anon INSERT on fuel_records
DROP POLICY IF EXISTS "Public can insert fuel_records" ON public.fuel_records;
CREATE POLICY "Public can insert fuel_records"
ON public.fuel_records
FOR INSERT
TO anon
WITH CHECK (
  tenant_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.equipments e WHERE e.id = fuel_records.combo_equipment_id AND e.tenant_id = fuel_records.tenant_id)
    OR EXISTS (SELECT 1 FROM public.equipments e WHERE e.id = fuel_records.target_equipment_id AND e.tenant_id = fuel_records.tenant_id)
  )
);

-- 5) Tighten anon INSERT on maintenance_history
DROP POLICY IF EXISTS "Public can insert maintenance_history" ON public.maintenance_history;
CREATE POLICY "Public can insert maintenance_history"
ON public.maintenance_history
FOR INSERT
TO anon
WITH CHECK (
  tenant_id IS NOT NULL
  AND equipment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.equipments e
    WHERE e.id = maintenance_history.equipment_id AND e.tenant_id = maintenance_history.tenant_id
  )
);

-- 6) Tighten anon UPDATE on work_orders: forbid changing tenant_id, equipment_id, os_number, or maintenance_request_id
DROP POLICY IF EXISTS "Public can update work_orders for QR" ON public.work_orders;
CREATE POLICY "Public can update work_orders for QR"
ON public.work_orders
FOR UPDATE
TO anon
USING (true)
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM public.work_orders w WHERE w.id = work_orders.id)
  AND equipment_id = (SELECT equipment_id FROM public.work_orders w WHERE w.id = work_orders.id)
  AND os_number = (SELECT os_number FROM public.work_orders w WHERE w.id = work_orders.id)
  AND maintenance_request_id = (SELECT maintenance_request_id FROM public.work_orders w WHERE w.id = work_orders.id)
);

-- 7) Cross-tenant admin escalation: add tenant-scoped variant and tighten "Admins manage tenants" policy
CREATE OR REPLACE FUNCTION public.has_role_in_tenant(_user_id uuid, _role public.app_role, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant_id
  )
$$;

DROP POLICY IF EXISTS "Admins manage tenants" ON public.tenants;
CREATE POLICY "Admins manage tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (public.has_role_in_tenant(auth.uid(), 'admin'::public.app_role, id))
WITH CHECK (public.has_role_in_tenant(auth.uid(), 'admin'::public.app_role, id));

-- 8) Tighten storage photos bucket: require authenticated users to upload
DROP POLICY IF EXISTS "Anyone can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload photos" ON storage.objects;
CREATE POLICY "Authenticated can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photos');
