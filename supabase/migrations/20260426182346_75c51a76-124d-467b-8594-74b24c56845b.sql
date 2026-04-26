CREATE OR REPLACE FUNCTION public.update_my_tenant_branding(
  _nome_exibicao text DEFAULT NULL,
  _logo_url text DEFAULT NULL,
  _cor_primaria text DEFAULT NULL,
  _cor_secundaria text DEFAULT NULL,
  _cor_alerta text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_tenant uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar a identidade visual';
  END IF;

  my_tenant := public.get_my_tenant_id();
  IF my_tenant IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada para o usuário';
  END IF;

  UPDATE public.tenants
  SET
    nome_exibicao  = COALESCE(NULLIF(btrim(_nome_exibicao), ''), nome_exibicao),
    logo_url       = CASE WHEN _logo_url IS NULL THEN logo_url ELSE NULLIF(btrim(_logo_url), '') END,
    cor_primaria   = COALESCE(NULLIF(btrim(_cor_primaria), ''), cor_primaria),
    cor_secundaria = COALESCE(NULLIF(btrim(_cor_secundaria), ''), cor_secundaria),
    cor_alerta     = COALESCE(NULLIF(btrim(_cor_alerta), ''), cor_alerta),
    updated_at     = now()
  WHERE id = my_tenant;

  RETURN true;
END;
$$;