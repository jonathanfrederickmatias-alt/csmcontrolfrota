INSERT INTO public.maintenance_plans (tenant_id, equipment_id, description, plan_type, interval_hours, last_done_at, next_due_at, interval_days, status)
SELECT p.tenant_id, '162c001d-1318-49dc-b8c8-3887e5d79175', p.description, p.plan_type, p.interval_hours, 0, p.interval_hours, NULL, 'ok'
FROM public.maintenance_plans p
WHERE p.equipment_id = '1ccced59-2811-4857-9de2-cddbc1765bd9';