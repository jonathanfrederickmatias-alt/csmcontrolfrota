DROP POLICY IF EXISTS "Managers create fuel alert dismissals" ON public.fuel_alert_dismissals;
CREATE POLICY "Managers create fuel alert dismissals" ON public.fuel_alert_dismissals FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_my_tenant_id() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor') OR has_role(auth.uid(),'abastecedor')));