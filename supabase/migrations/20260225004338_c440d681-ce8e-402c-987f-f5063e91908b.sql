
-- Recreate the trigger for auto-creating work orders
DROP TRIGGER IF EXISTS trigger_auto_create_work_order ON public.maintenance_requests;

CREATE TRIGGER trigger_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();
