
ALTER TABLE public.maintenance_history DROP CONSTRAINT maintenance_history_equipment_id_fkey;
ALTER TABLE public.maintenance_history ALTER COLUMN equipment_id DROP NOT NULL;
ALTER TABLE public.maintenance_history ADD CONSTRAINT maintenance_history_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipments(id) ON DELETE SET NULL;

ALTER TABLE public.work_orders DROP CONSTRAINT work_orders_equipment_id_fkey;
ALTER TABLE public.work_orders ALTER COLUMN equipment_id DROP NOT NULL;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipments(id) ON DELETE SET NULL;
