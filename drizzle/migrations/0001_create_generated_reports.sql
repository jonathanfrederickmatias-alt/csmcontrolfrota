CREATE TABLE public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  report_type text NOT NULL DEFAULT 'fuel_weekly',
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  file_url text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.generated_reports TO authenticated;
GRANT ALL ON public.generated_reports TO service_role;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tenant reports" ON public.generated_reports
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());