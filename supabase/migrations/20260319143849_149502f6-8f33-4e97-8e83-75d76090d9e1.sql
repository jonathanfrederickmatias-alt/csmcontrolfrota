
CREATE TRIGGER update_hour_meter_on_checklist_insert
  AFTER INSERT ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hour_meter_on_checklist();
