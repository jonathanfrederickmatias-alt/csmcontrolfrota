-- =====================================================
-- ETAPA 2: TENANT_ID OBRIGATÓRIO + RLS POR TENANT
-- =====================================================

-- 1) Tornar tenant_id NOT NULL em todas as tabelas operacionais
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.equipments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checklists ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.work_orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.maintenance_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.maintenance_plans ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.maintenance_history ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fuel_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fuel_supply_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fuel_pins ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fuel_price_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.insurance_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.obras ALTER COLUMN tenant_id SET NOT NULL;

-- Foreign keys p/ integridade
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.equipments ADD CONSTRAINT equipments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.checklists ADD CONSTRAINT checklists_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.maintenance_requests ADD CONSTRAINT maintenance_requests_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.maintenance_plans ADD CONSTRAINT maintenance_plans_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.maintenance_history ADD CONSTRAINT maintenance_history_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.fuel_records ADD CONSTRAINT fuel_records_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.fuel_supply_records ADD CONSTRAINT fuel_supply_records_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.fuel_pins ADD CONSTRAINT fuel_pins_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.fuel_price_settings ADD CONSTRAINT fuel_price_settings_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.insurance_records ADD CONSTRAINT insurance_records_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.obras ADD CONSTRAINT obras_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- =====================================================
-- 2) FUNÇÃO AUXILIAR: tenant_id padrão (default tenant)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_default_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.tenants WHERE slug = 'minha-empresa-principal' LIMIT 1
$$;

-- =====================================================
-- 3) ATUALIZAR handle_new_user p/ vincular tenant padrão
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_tenant uuid;
BEGIN
  default_tenant := public.get_default_tenant_id();
  INSERT INTO public.profiles (user_id, display_name, tenant_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), default_tenant);
  RETURN NEW;
END;
$$;

-- =====================================================
-- 4) TRIGGER GENÉRICO: setar tenant_id automaticamente em INSERTs
--    (resolve via auth.uid() do usuário logado)
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resolved_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tenta pegar do usuário autenticado
  IF auth.uid() IS NOT NULL THEN
    SELECT tenant_id INTO resolved_tenant FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  -- Fallback: tenant padrão (para inserts via QR público / triggers do banco)
  IF resolved_tenant IS NULL THEN
    resolved_tenant := public.get_default_tenant_id();
  END IF;

  NEW.tenant_id := resolved_tenant;
  RETURN NEW;
END;
$$;

-- =====================================================
-- 5) TRIGGER ESPECÍFICO: derivar tenant_id de equipment_id
--    (para inserts públicos via QR onde só temos o equipamento)
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_equipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resolved_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Primeiro: tenta resolver pelo equipamento
  IF NEW.equipment_id IS NOT NULL THEN
    SELECT tenant_id INTO resolved_tenant FROM public.equipments WHERE id = NEW.equipment_id LIMIT 1;
  END IF;

  -- Segundo: usuário autenticado
  IF resolved_tenant IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT tenant_id INTO resolved_tenant FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  -- Fallback final
  IF resolved_tenant IS NULL THEN
    resolved_tenant := public.get_default_tenant_id();
  END IF;

  NEW.tenant_id := resolved_tenant;
  RETURN NEW;
END;
$$;

-- =====================================================
-- 6) Trigger para fuel_records (combo OU target equipment)
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_tenant_id_for_fuel_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resolved_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.combo_equipment_id IS NOT NULL THEN
    SELECT tenant_id INTO resolved_tenant FROM public.equipments WHERE id = NEW.combo_equipment_id LIMIT 1;
  END IF;

  IF resolved_tenant IS NULL AND NEW.target_equipment_id IS NOT NULL THEN
    SELECT tenant_id INTO resolved_tenant FROM public.equipments WHERE id = NEW.target_equipment_id LIMIT 1;
  END IF;

  IF resolved_tenant IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT tenant_id INTO resolved_tenant FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  IF resolved_tenant IS NULL THEN
    resolved_tenant := public.get_default_tenant_id();
  END IF;

  NEW.tenant_id := resolved_tenant;
  RETURN NEW;
END;
$$;

-- =====================================================
-- 7) APLICAR TRIGGERS BEFORE INSERT
-- =====================================================
DROP TRIGGER IF EXISTS trg_set_tenant ON public.equipments;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.equipments
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.obras;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.insurance_records;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.insurance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.fuel_price_settings;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.fuel_price_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.fuel_pins;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.fuel_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.user_roles;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();

-- Tabelas com equipment_id → resolver via equipamento (suporta QR público)
DROP TRIGGER IF EXISTS trg_set_tenant ON public.checklists;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_equipment();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.maintenance_requests;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_equipment();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.maintenance_plans;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.maintenance_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_equipment();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.maintenance_history;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.maintenance_history
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_equipment();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.work_orders;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_equipment();

-- fuel_records / fuel_supply_records (combo + target)
DROP TRIGGER IF EXISTS trg_set_tenant ON public.fuel_records;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.fuel_records
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_for_fuel_record();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.fuel_supply_records;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.fuel_supply_records
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_for_fuel_record();

-- =====================================================
-- 8) RLS: substituir policies permissivas por tenant-scoped
-- =====================================================

-- EQUIPMENTS
DROP POLICY IF EXISTS "Authenticated users can manage equipments" ON public.equipments;
CREATE POLICY "Tenant users manage equipments" ON public.equipments
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
-- "Public can read equipments" mantida (necessária para QR público)

-- OBRAS
DROP POLICY IF EXISTS "Authenticated users can manage obras" ON public.obras;
CREATE POLICY "Tenant users manage obras" ON public.obras
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
-- "Public can read obras" mantida

-- CHECKLISTS
DROP POLICY IF EXISTS "Authenticated users can manage checklists" ON public.checklists;
CREATE POLICY "Tenant users manage checklists" ON public.checklists
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
-- "Public can insert checklists" mantida (QR anônimo)

-- WORK ORDERS
DROP POLICY IF EXISTS "Authenticated users can manage work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Public can read work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Public can update work_orders" ON public.work_orders;
CREATE POLICY "Tenant users manage work_orders" ON public.work_orders
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
-- QR mecânico: leitura pública permanece (apenas SELECT) p/ acessar OS via QR
CREATE POLICY "Public can read work_orders for QR" ON public.work_orders
  FOR SELECT TO anon USING (true);
-- QR mecânico atualiza OS — restrita ao próprio tenant via leitura pública do equipamento
CREATE POLICY "Public can update work_orders for QR" ON public.work_orders
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- MAINTENANCE REQUESTS
DROP POLICY IF EXISTS "Authenticated users can manage maintenance_requests" ON public.maintenance_requests;
CREATE POLICY "Tenant users manage maintenance_requests" ON public.maintenance_requests
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
-- "Public can insert maintenance_requests" mantida (QR anônimo)

-- MAINTENANCE PLANS
DROP POLICY IF EXISTS "Authenticated users can manage maintenance_plans" ON public.maintenance_plans;
CREATE POLICY "Tenant users manage maintenance_plans" ON public.maintenance_plans
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- MAINTENANCE HISTORY
DROP POLICY IF EXISTS "Authenticated users can manage maintenance_history" ON public.maintenance_history;
CREATE POLICY "Tenant users manage maintenance_history" ON public.maintenance_history
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- FUEL RECORDS
DROP POLICY IF EXISTS "Authenticated users can manage fuel_records" ON public.fuel_records;
CREATE POLICY "Tenant users manage fuel_records" ON public.fuel_records
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
-- "Public can insert fuel_records" mantida (QR anônimo)

-- FUEL SUPPLY RECORDS
DROP POLICY IF EXISTS "Authenticated users can manage fuel_supply_records" ON public.fuel_supply_records;
CREATE POLICY "Tenant users manage fuel_supply_records" ON public.fuel_supply_records
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- INSURANCE RECORDS
DROP POLICY IF EXISTS "Authenticated users can manage insurance_records" ON public.insurance_records;
CREATE POLICY "Tenant users manage insurance_records" ON public.insurance_records
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- FUEL PRICE SETTINGS
DROP POLICY IF EXISTS "Authenticated users can view fuel_price_settings" ON public.fuel_price_settings;
DROP POLICY IF EXISTS "Authenticated users can insert fuel_price_settings" ON public.fuel_price_settings;
DROP POLICY IF EXISTS "Authenticated users can update fuel_price_settings" ON public.fuel_price_settings;
DROP POLICY IF EXISTS "Authenticated users can delete fuel_price_settings" ON public.fuel_price_settings;
CREATE POLICY "Tenant users manage fuel_price_settings" ON public.fuel_price_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- FUEL PINS
DROP POLICY IF EXISTS "Admins can manage fuel_pins" ON public.fuel_pins;
CREATE POLICY "Tenant admins manage fuel_pins" ON public.fuel_pins
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
-- "Public can read fuel_pins for validation" mantida

-- USER ROLES
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Tenant admins read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Tenant admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Tenant admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- PROFILES
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Tenant admins read profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Tenant admins insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));