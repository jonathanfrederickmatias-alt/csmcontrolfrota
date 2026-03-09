-- Recreate trigger for auto-creating work orders from maintenance requests
DROP TRIGGER IF EXISTS trg_auto_create_work_order ON public.maintenance_requests;

CREATE TRIGGER trg_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();