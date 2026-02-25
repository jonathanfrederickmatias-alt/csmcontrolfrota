-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.auto_create_work_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.work_orders (maintenance_request_id, equipment_id, description, priority)
  VALUES (NEW.id, NEW.equipment_id, NEW.description, NEW.priority);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_create_work_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;
