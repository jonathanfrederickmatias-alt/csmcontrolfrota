-- =====================================================
-- ETAPA 3: FUNÇÕES DE GESTÃO DE TENANTS (Super-admin)
-- =====================================================

-- 1) Criar nova empresa (tenant) — apenas super-admin
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  _name text,
  _slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Apenas admins podem criar tenants
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar empresas';
  END IF;

  -- Validações básicas
  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório';
  END IF;

  IF _slug IS NULL OR btrim(_slug) = '' THEN
    RAISE EXCEPTION 'Slug da empresa é obrigatório';
  END IF;

  -- Criar tenant
  INSERT INTO public.tenants (name, slug, status)
  VALUES (btrim(_name), lower(btrim(_slug)), 'ACTIVE')
  RETURNING id INTO new_tenant_id;

  RETURN new_tenant_id;
END;
$$;

-- 2) Atribuir usuário existente a uma empresa — apenas super-admin
CREATE OR REPLACE FUNCTION public.admin_assign_user_to_tenant(
  _user_id uuid,
  _tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem mover usuários entre empresas';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  -- Atualizar profile
  UPDATE public.profiles
  SET tenant_id = _tenant_id
  WHERE user_id = _user_id;

  -- Atualizar user_roles do usuário também
  UPDATE public.user_roles
  SET tenant_id = _tenant_id
  WHERE user_id = _user_id;

  -- Atualizar fuel_pins se houver
  UPDATE public.fuel_pins
  SET tenant_id = _tenant_id
  WHERE user_id = _user_id;

  RETURN true;
END;
$$;

-- 3) Listar tenants (admin vê todos, usuário comum vê só o próprio)
CREATE OR REPLACE FUNCTION public.list_my_tenants()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.slug, t.status, t.created_at
  FROM public.tenants t
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
     OR t.id = public.get_my_tenant_id()
  ORDER BY t.created_at ASC
$$;