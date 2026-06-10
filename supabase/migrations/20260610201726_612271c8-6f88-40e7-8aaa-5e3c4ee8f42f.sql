
ALTER TABLE public.work_orders DROP CONSTRAINT work_orders_equipment_id_fkey;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipments(id) ON DELETE CASCADE;
