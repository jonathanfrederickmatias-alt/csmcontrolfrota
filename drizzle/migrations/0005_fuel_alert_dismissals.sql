CREATE TABLE public.fuel_alert_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.get_my_tenant_id() REFERENCES public.tenants(id),
  alert_key text NOT NULL,
  record_id uuid,
  dismissed_by uuid DEFAULT auth.uid(),
  dismissed_by_name text,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, alert_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_alert_dismissals TO authenticated;
GRANT ALL ON public.fuel_alert_dismissals TO service_role;
ALTER TABLE public.fuel_alert_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant users read fuel alert dismissals" ON public.fuel_alert_dismissals
  FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "Managers create fuel alert dismissals" ON public.fuel_alert_dismissals
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  );
CREATE POLICY "Managers delete fuel alert dismissals" ON public.fuel_alert_dismissals
  FOR DELETE TO authenticated USING (
    tenant_id = public.get_my_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  );