
-- Add mechanic-specific columns to work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS part_code text,
  ADD COLUMN IF NOT EXISTS photo_start_url text,
  ADD COLUMN IF NOT EXISTS photo_end_url text;

-- Allow public to read and update work_orders (mechanic access via QR)
DROP POLICY IF EXISTS "Public can update work_orders" ON public.work_orders;
CREATE POLICY "Public can update work_orders"
  ON public.work_orders
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Trigger: when OS is completed, auto-insert into maintenance_history
CREATE OR REPLACE FUNCTION public.auto_create_maintenance_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    INSERT INTO public.maintenance_history (equipment_id, description, hour_meter, operator_name, notes)
    SELECT
      NEW.equipment_id,
      'OS #' || NEW.os_number || ' - ' || NEW.description,
      COALESCE(e.current_hour_meter, 0),
      COALESCE(NEW.mechanic_name, 'Mecânico'),
      'Peça: ' || COALESCE(NEW.part_code, 'N/A')
    FROM public.equipments e
    WHERE e.id = NEW.equipment_id;

    -- Also update maintenance_request status to done
    UPDATE public.maintenance_requests
    SET status = 'done', resolved_at = now()
    WHERE id = NEW.maintenance_request_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_maintenance_history ON public.work_orders;
CREATE TRIGGER trigger_auto_maintenance_history
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_maintenance_history();
