UPDATE public.maintenance_history SET plan_id = NULL WHERE plan_id = '4772d8f3-7e9c-4cee-9da0-5332bce4e6d3';
UPDATE public.work_orders SET maintenance_plan_id = NULL WHERE maintenance_plan_id = '4772d8f3-7e9c-4cee-9da0-5332bce4e6d3';
DELETE FROM public.maintenance_plans WHERE id = '4772d8f3-7e9c-4cee-9da0-5332bce4e6d3';