CREATE TABLE public.equipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  equipment_id uuid NOT NULL,
  document_type text NOT NULL,
  document_name text,
  document_number text,
  issue_date date,
  expiry_date date,
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users manage equipment_documents"
ON public.equipment_documents
FOR ALL
TO authenticated
USING (tenant_id = public.get_my_tenant_id())
WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER set_tenant_id_equipment_documents
BEFORE INSERT ON public.equipment_documents
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_equipment();

CREATE TRIGGER update_equipment_documents_updated_at
BEFORE UPDATE ON public.equipment_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_equipment_documents_equipment ON public.equipment_documents(equipment_id);
CREATE INDEX idx_equipment_documents_expiry ON public.equipment_documents(expiry_date);