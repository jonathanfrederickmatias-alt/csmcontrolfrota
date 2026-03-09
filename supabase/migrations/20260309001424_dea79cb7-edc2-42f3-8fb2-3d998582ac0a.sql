CREATE TRIGGER on_work_order_done
  AFTER UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_maintenance_history();