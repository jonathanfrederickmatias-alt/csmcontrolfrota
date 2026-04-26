-- 1) Adicionar campos de white label (idempotente)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS nome_exibicao text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cor_primaria text,
  ADD COLUMN IF NOT EXISTS cor_secundaria text,
  ADD COLUMN IF NOT EXISTS cor_alerta text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- 2) Backfill da empresa principal (CSM) — só se ainda não definido
UPDATE public.tenants
SET
  nome_exibicao = COALESCE(nome_exibicao, 'CSM CONTROLFROTA'),
  cor_primaria  = COALESCE(cor_primaria, '#1E3A8A'),
  cor_secundaria = COALESCE(cor_secundaria, '#0F172A'),
  cor_alerta    = COALESCE(cor_alerta, '#DC2626')
WHERE slug = 'minha-empresa-principal';

-- 3) Demais tenants: fallback usando o próprio nome + cor neutra padrão
UPDATE public.tenants
SET
  nome_exibicao = COALESCE(nome_exibicao, name),
  cor_primaria  = COALESCE(cor_primaria, '#003B73'),
  cor_secundaria = COALESCE(cor_secundaria, '#0F172A'),
  cor_alerta    = COALESCE(cor_alerta, '#DC2626')
WHERE slug <> 'minha-empresa-principal';

-- 4) Permitir leitura pública (anon) da identidade visual para páginas via QR Code
--    NÃO removemos as policies existentes — apenas adicionamos uma SELECT para anon.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'Public can read tenant branding'
  ) THEN
    CREATE POLICY "Public can read tenant branding"
      ON public.tenants
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- 5) RPC para o frontend autenticado pegar o branding do próprio tenant
CREATE OR REPLACE FUNCTION public.get_my_tenant_branding()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  nome_exibicao text,
  logo_url text,
  cor_primaria text,
  cor_secundaria text,
  cor_alerta text,
  ativo boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.slug, t.nome_exibicao, t.logo_url,
         t.cor_primaria, t.cor_secundaria, t.cor_alerta, t.ativo
  FROM public.tenants t
  WHERE t.id = public.get_my_tenant_id()
  LIMIT 1;
$$;

-- 6) RPC para admins atualizarem branding de qualquer tenant
CREATE OR REPLACE FUNCTION public.admin_update_tenant_branding(
  _tenant_id uuid,
  _nome_exibicao text DEFAULT NULL,
  _logo_url text DEFAULT NULL,
  _cor_primaria text DEFAULT NULL,
  _cor_secundaria text DEFAULT NULL,
  _cor_alerta text DEFAULT NULL,
  _ativo boolean DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar identidade visual';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  UPDATE public.tenants
  SET
    nome_exibicao  = COALESCE(_nome_exibicao, nome_exibicao),
    logo_url       = COALESCE(_logo_url, logo_url),
    cor_primaria   = COALESCE(_cor_primaria, cor_primaria),
    cor_secundaria = COALESCE(_cor_secundaria, cor_secundaria),
    cor_alerta     = COALESCE(_cor_alerta, cor_alerta),
    ativo          = COALESCE(_ativo, ativo),
    updated_at     = now()
  WHERE id = _tenant_id;

  RETURN true;
END;
$$;