REVOKE ALL ON FUNCTION public.recalc_equipment_release_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_equipment_release_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_create_maintenance_history() FROM PUBLIC, anon, authenticated;