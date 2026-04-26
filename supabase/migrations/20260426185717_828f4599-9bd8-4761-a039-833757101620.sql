-- 1. Adicionar novos campos à tabela tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email_admin text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS tipo_empresa text,
  ADD COLUMN IF NOT EXISTS responsavel_principal text,
  ADD COLUMN IF NOT EXISTS email_alertas text,
  ADD COLUMN IF NOT EXISTS whatsapp_alertas text,
  ADD COLUMN IF NOT EXISTS horario_operacao text,
  ADD COLUMN IF NOT EXISTS fuso_horario text DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS moeda text DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS relatorio_mostrar_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS relatorio_mostrar_cnpj boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS relatorio_rodape text,
  ADD COLUMN IF NOT EXISTS relatorio_assinatura text;

-- 2. Recriar get_my_tenant_branding (precisa DROP por mudança de tipo de retorno)
DROP FUNCTION IF EXISTS public.get_my_tenant_branding();
CREATE FUNCTION public.get_my_tenant_branding()
RETURNS TABLE(
  id uuid, name text, slug text,
  nome_exibicao text, logo_url text, favicon_url text,
  cor_primaria text, cor_secundaria text, cor_alerta text,
  ativo boolean,
  razao_social text, nome_fantasia text, cnpj text, inscricao_estadual text,
  telefone text, whatsapp text, email_admin text, site text,
  endereco text, cidade text, estado text, cep text,
  tipo_empresa text, responsavel_principal text,
  email_alertas text, whatsapp_alertas text,
  horario_operacao text, fuso_horario text, moeda text,
  relatorio_mostrar_logo boolean, relatorio_mostrar_cnpj boolean,
  relatorio_rodape text, relatorio_assinatura text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.slug,
         t.nome_exibicao, t.logo_url, t.favicon_url,
         t.cor_primaria, t.cor_secundaria, t.cor_alerta,
         t.ativo,
         t.razao_social, t.nome_fantasia, t.cnpj, t.inscricao_estadual,
         t.telefone, t.whatsapp, t.email_admin, t.site,
         t.endereco, t.cidade, t.estado, t.cep,
         t.tipo_empresa, t.responsavel_principal,
         t.email_alertas, t.whatsapp_alertas,
         t.horario_operacao, t.fuso_horario, t.moeda,
         t.relatorio_mostrar_logo, t.relatorio_mostrar_cnpj,
         t.relatorio_rodape, t.relatorio_assinatura
  FROM public.tenants t
  WHERE t.id = public.get_my_tenant_id()
  LIMIT 1;
$$;

-- 3. Recriar update_my_tenant_branding com todos os novos campos
DROP FUNCTION IF EXISTS public.update_my_tenant_branding(text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.update_my_tenant_branding(
  _nome_exibicao text DEFAULT NULL,
  _logo_url text DEFAULT NULL,
  _cor_primaria text DEFAULT NULL,
  _cor_secundaria text DEFAULT NULL,
  _cor_alerta text DEFAULT NULL,
  _favicon_url text DEFAULT NULL,
  _razao_social text DEFAULT NULL,
  _nome_fantasia text DEFAULT NULL,
  _cnpj text DEFAULT NULL,
  _inscricao_estadual text DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _whatsapp text DEFAULT NULL,
  _email_admin text DEFAULT NULL,
  _site text DEFAULT NULL,
  _endereco text DEFAULT NULL,
  _cidade text DEFAULT NULL,
  _estado text DEFAULT NULL,
  _cep text DEFAULT NULL,
  _tipo_empresa text DEFAULT NULL,
  _responsavel_principal text DEFAULT NULL,
  _email_alertas text DEFAULT NULL,
  _whatsapp_alertas text DEFAULT NULL,
  _horario_operacao text DEFAULT NULL,
  _fuso_horario text DEFAULT NULL,
  _moeda text DEFAULT NULL,
  _relatorio_mostrar_logo boolean DEFAULT NULL,
  _relatorio_mostrar_cnpj boolean DEFAULT NULL,
  _relatorio_rodape text DEFAULT NULL,
  _relatorio_assinatura text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  my_tenant uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar as configurações da empresa';
  END IF;

  my_tenant := public.get_my_tenant_id();
  IF my_tenant IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada para o usuário';
  END IF;

  UPDATE public.tenants
  SET
    nome_exibicao  = COALESCE(NULLIF(btrim(_nome_exibicao), ''), nome_exibicao),
    logo_url       = CASE WHEN _logo_url IS NULL THEN logo_url ELSE NULLIF(btrim(_logo_url), '') END,
    favicon_url    = CASE WHEN _favicon_url IS NULL THEN favicon_url ELSE NULLIF(btrim(_favicon_url), '') END,
    cor_primaria   = COALESCE(NULLIF(btrim(_cor_primaria), ''), cor_primaria),
    cor_secundaria = COALESCE(NULLIF(btrim(_cor_secundaria), ''), cor_secundaria),
    cor_alerta     = COALESCE(NULLIF(btrim(_cor_alerta), ''), cor_alerta),
    razao_social         = CASE WHEN _razao_social IS NULL THEN razao_social ELSE NULLIF(btrim(_razao_social), '') END,
    nome_fantasia        = CASE WHEN _nome_fantasia IS NULL THEN nome_fantasia ELSE NULLIF(btrim(_nome_fantasia), '') END,
    cnpj                 = CASE WHEN _cnpj IS NULL THEN cnpj ELSE NULLIF(btrim(_cnpj), '') END,
    inscricao_estadual   = CASE WHEN _inscricao_estadual IS NULL THEN inscricao_estadual ELSE NULLIF(btrim(_inscricao_estadual), '') END,
    telefone             = CASE WHEN _telefone IS NULL THEN telefone ELSE NULLIF(btrim(_telefone), '') END,
    whatsapp             = CASE WHEN _whatsapp IS NULL THEN whatsapp ELSE NULLIF(btrim(_whatsapp), '') END,
    email_admin          = CASE WHEN _email_admin IS NULL THEN email_admin ELSE NULLIF(btrim(_email_admin), '') END,
    site                 = CASE WHEN _site IS NULL THEN site ELSE NULLIF(btrim(_site), '') END,
    endereco             = CASE WHEN _endereco IS NULL THEN endereco ELSE NULLIF(btrim(_endereco), '') END,
    cidade               = CASE WHEN _cidade IS NULL THEN cidade ELSE NULLIF(btrim(_cidade), '') END,
    estado               = CASE WHEN _estado IS NULL THEN estado ELSE NULLIF(btrim(_estado), '') END,
    cep                  = CASE WHEN _cep IS NULL THEN cep ELSE NULLIF(btrim(_cep), '') END,
    tipo_empresa         = CASE WHEN _tipo_empresa IS NULL THEN tipo_empresa ELSE NULLIF(btrim(_tipo_empresa), '') END,
    responsavel_principal= CASE WHEN _responsavel_principal IS NULL THEN responsavel_principal ELSE NULLIF(btrim(_responsavel_principal), '') END,
    email_alertas        = CASE WHEN _email_alertas IS NULL THEN email_alertas ELSE NULLIF(btrim(_email_alertas), '') END,
    whatsapp_alertas     = CASE WHEN _whatsapp_alertas IS NULL THEN whatsapp_alertas ELSE NULLIF(btrim(_whatsapp_alertas), '') END,
    horario_operacao     = CASE WHEN _horario_operacao IS NULL THEN horario_operacao ELSE NULLIF(btrim(_horario_operacao), '') END,
    fuso_horario         = COALESCE(NULLIF(btrim(_fuso_horario), ''), fuso_horario),
    moeda                = COALESCE(NULLIF(btrim(_moeda), ''), moeda),
    relatorio_mostrar_logo  = COALESCE(_relatorio_mostrar_logo, relatorio_mostrar_logo),
    relatorio_mostrar_cnpj  = COALESCE(_relatorio_mostrar_cnpj, relatorio_mostrar_cnpj),
    relatorio_rodape        = CASE WHEN _relatorio_rodape IS NULL THEN relatorio_rodape ELSE NULLIF(btrim(_relatorio_rodape), '') END,
    relatorio_assinatura    = CASE WHEN _relatorio_assinatura IS NULL THEN relatorio_assinatura ELSE NULLIF(btrim(_relatorio_assinatura), '') END,
    updated_at     = now()
  WHERE id = my_tenant;

  RETURN true;
END;
$$;