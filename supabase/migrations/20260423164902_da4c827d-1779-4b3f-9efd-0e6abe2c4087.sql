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

  INSERT INTO public.work_orders (maintenance_request_id, equipment_id, description, priority)
  VALUES (
    NEW.id,
    NEW.equipment_id,
    NEW.description,
    NEW.priority
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_create_work_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;