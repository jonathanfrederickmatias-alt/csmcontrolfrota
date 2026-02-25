
-- Fix: maintenance_requests public insert policy is RESTRICTIVE, needs to be PERMISSIVE
DROP POLICY IF EXISTS "Public can insert maintenance_requests" ON public.maintenance_requests;
CREATE POLICY "Public can insert maintenance_requests"
  ON public.maintenance_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Fix: work_orders needs public insert for the trigger to work (trigger runs as SECURITY DEFINER but let's also allow public read)
-- Already has public SELECT, good.

-- Recreate the trigger that was lost
DROP TRIGGER IF EXISTS trigger_auto_create_work_order ON public.maintenance_requests;
CREATE TRIGGER trigger_auto_create_work_order
  AFTER INSERT ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_work_order();
