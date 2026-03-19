
CREATE TABLE public.insurance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  insurance_company text NOT NULL,
  policy_number text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage insurance_records"
  ON public.insurance_records FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_insurance_records_updated_at
  BEFORE UPDATE ON public.insurance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
