CREATE TABLE public.checklist_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  category text NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, category)
);

GRANT SELECT ON public.checklist_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver modelos de checklist"
ON public.checklist_templates FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins e gestores gerenciam modelos"
ON public.checklist_templates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

CREATE TRIGGER update_checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();