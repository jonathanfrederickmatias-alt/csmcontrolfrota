
-- =========================================================================
-- ETAPA 1: Criação da estrutura multi-tenant (sem bloquear nada)
-- =========================================================================

-- 1) Tabela tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tenants_set_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Criar tenant default ANTES do backfill
INSERT INTO public.tenants (name, slug, status)
VALUES ('Minha Empresa Principal', 'minha-empresa-principal', 'ACTIVE')
ON CONFLICT (slug) DO NOTHING;

-- 3) Adicionar tenant_id (nullable) em todas as tabelas operacionais
ALTER TABLE public.equipments            ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.obras                 ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.checklists            ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.maintenance_requests  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.work_orders           ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.maintenance_plans     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.maintenance_history   ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.fuel_records          ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.fuel_supply_records   ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.fuel_price_settings   ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.insurance_records     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.fuel_pins             ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.profiles              ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.user_roles            ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- 4) BACKFILL — atribuir todos os registros existentes ao tenant default
DO $$
DECLARE
  v_tenant_id uuid;
  v_equipments int; v_obras int; v_checklists int; v_mreq int; v_wo int;
  v_mplans int; v_mhist int; v_fr int; v_fsr int; v_fps int;
  v_ins int; v_fp int; v_prof int; v_roles int;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'minha-empresa-principal';

  UPDATE public.equipments           SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_equipments = ROW_COUNT;

  UPDATE public.obras                SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_obras = ROW_COUNT;

  UPDATE public.checklists           SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_checklists = ROW_COUNT;

  UPDATE public.maintenance_requests SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_mreq = ROW_COUNT;

  UPDATE public.work_orders          SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_wo = ROW_COUNT;

  UPDATE public.maintenance_plans    SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_mplans = ROW_COUNT;

  UPDATE public.maintenance_history  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_mhist = ROW_COUNT;

  UPDATE public.fuel_records         SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_fr = ROW_COUNT;

  UPDATE public.fuel_supply_records  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_fsr = ROW_COUNT;

  UPDATE public.fuel_price_settings  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_fps = ROW_COUNT;

  UPDATE public.insurance_records    SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  UPDATE public.fuel_pins            SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_fp = ROW_COUNT;

  UPDATE public.profiles             SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_prof = ROW_COUNT;

  UPDATE public.user_roles           SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_roles = ROW_COUNT;

  RAISE NOTICE 'Backfill multi-tenant concluído. tenant_id=%', v_tenant_id;
  RAISE NOTICE 'equipments=% obras=% checklists=% maintenance_requests=% work_orders=% maintenance_plans=% maintenance_history=% fuel_records=% fuel_supply_records=% fuel_price_settings=% insurance_records=% fuel_pins=% profiles=% user_roles=%',
    v_equipments, v_obras, v_checklists, v_mreq, v_wo, v_mplans, v_mhist, v_fr, v_fsr, v_fps, v_ins, v_fp, v_prof, v_roles;
END $$;

-- 5) Índices para performance dos filtros por tenant
CREATE INDEX IF NOT EXISTS idx_equipments_tenant            ON public.equipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_obras_tenant                 ON public.obras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checklists_tenant            ON public.checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant  ON public.maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant           ON public.work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_plans_tenant     ON public.maintenance_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_history_tenant   ON public.maintenance_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_tenant          ON public.fuel_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_supply_records_tenant   ON public.fuel_supply_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_price_settings_tenant   ON public.fuel_price_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insurance_records_tenant     ON public.insurance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_pins_tenant             ON public.fuel_pins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant              ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant            ON public.user_roles(tenant_id);

-- 6) Função para descobrir o tenant do usuário logado (SECURITY DEFINER, evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- 7) Trigger no signup: novos usuários ficam SEM tenant até um admin atribuir.
--    (mantemos o handle_new_user atual; só garantimos que tenant_id começa NULL — já é o default)

-- 8) RLS policies da tabela tenants
DROP POLICY IF EXISTS "Users can read own tenant" ON public.tenants;
CREATE POLICY "Users can read own tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (id = public.get_my_tenant_id() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage tenants" ON public.tenants;
CREATE POLICY "Admins manage tenants"
ON public.tenants FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
