
-- Sequential OS number
CREATE SEQUENCE public.os_number_seq START 1;

-- Ordem de Serviço table
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_number integer NOT NULL DEFAULT nextval('public.os_number_seq'),
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE CASCADE NOT NULL,
  equipment_id uuid REFERENCES public.equipments(id) NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  mechanic_name text,
  status text NOT NULL DEFAULT 'open',
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage work_orders"
  ON public.work_orders FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can read work_orders"
  ON public.work_orders FOR SELECT
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create OS when maintenance_request is inserted
CREATE OR REPLACE FUNCTION public.auto_create_work_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.work_orders (maintenance_request_id, equipment_id, description, priority)
  VALUES (NEW.id, NEW.equipment_id, NEW.description, NEW.priority);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();
