CREATE TABLE public.report_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_settings TO authenticated;
GRANT ALL ON public.report_settings TO service_role;

ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read report_settings"
  ON public.report_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage report_settings"
  ON public.report_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.report_settings (key, value)
  VALUES ('onedrive_folder', 'CSMCONTROLFROTA/Relatorios Abastecimento')
  ON CONFLICT (key) DO NOTHING;