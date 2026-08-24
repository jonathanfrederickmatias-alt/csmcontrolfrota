ALTER TABLE public.maintenance_requests ADD COLUMN IF NOT EXISTS hour_meter numeric;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS opening_meter numeric;

CREATE OR REPLACE FUNCTION public.auto_create_work_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_request_id uuid;
BEGIN
  SELECT mr.id
  INTO existing_request_id
  FROM public.maintenance_requests mr
  JOIN public.work_orders wo ON wo.maintenance_request_id = mr.id
  WHERE mr.equipment_id = NEW.equipment_id
    AND mr.status IN ('open', 'in_progress')
    AND wo.status IN ('open', 'in_progress')
    AND btrim(lower(mr.description)) = btrim(lower(NEW.description))
  ORDER BY mr.created_at DESC
  LIMIT 1;

  IF existing_request_id IS NOT NULL THEN
    RAISE LOG 'auto_create_work_order skipped duplicate OS for equipment %, existing request %', NEW.equipment_id, existing_request_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.work_orders (maintenance_request_id, equipment_id, description, priority, opening_meter)
  VALUES (
    NEW.id,
    NEW.equipment_id,
    NEW.description,
    NEW.priority,
    NEW.hour_meter
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_create_work_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_hour_meter_on_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.hour_meter IS NOT NULL AND NEW.equipment_id IS NOT NULL THEN
    UPDATE public.equipments
    SET current_hour_meter = GREATEST(current_hour_meter, NEW.hour_meter),
        updated_at = now()
    WHERE id = NEW.equipment_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_hour_meter_on_request ON public.maintenance_requests;
CREATE TRIGGER trg_update_hour_meter_on_request
AFTER INSERT ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.update_hour_meter_on_request();