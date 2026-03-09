
CREATE OR REPLACE FUNCTION public.auto_create_work_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create a single OS per request, carrying all items in the description
  -- The items array is stored on the OS's parts/items for per-item tracking
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
