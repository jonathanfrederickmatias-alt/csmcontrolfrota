-- Política para inserts públicos via QR
CREATE POLICY "Public can insert maintenance_history"
ON public.maintenance_history
FOR INSERT
TO anon
WITH CHECK (true);

-- Trigger para preencher tenant_id a partir do equipamento
DROP TRIGGER IF EXISTS set_tenant_maintenance_history ON public.maintenance_history;
CREATE TRIGGER set_tenant_maintenance_history
BEFORE INSERT ON public.maintenance_history
FOR EACH ROW
EXECUTE FUNCTION public.set_tenant_id_from_equipment();