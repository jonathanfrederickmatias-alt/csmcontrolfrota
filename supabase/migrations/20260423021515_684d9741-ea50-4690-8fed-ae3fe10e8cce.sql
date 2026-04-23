CREATE TYPE public.maintenance_execution_type AS ENUM ('preventiva', 'corretiva');

CREATE TYPE public.work_order_final_status AS ENUM ('concluida', 'aguardando_peca', 'servico_externo', 'maquina_parada');

ALTER TABLE public.work_orders
ADD COLUMN maintenance_type public.maintenance_execution_type,
ADD COLUMN cause_identified text,
ADD COLUMN technical_observations text,
ADD COLUMN execution_meter numeric NOT NULL DEFAULT 0,
ADD COLUMN machine_released boolean NOT NULL DEFAULT false,
ADD COLUMN final_status public.work_order_final_status,
ADD COLUMN maintenance_plan_id uuid;

ALTER TABLE public.work_orders
ADD CONSTRAINT work_orders_maintenance_plan_id_fkey
FOREIGN KEY (maintenance_plan_id) REFERENCES public.maintenance_plans(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.auto_create_maintenance_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parts_text text := '';
  part_record jsonb;
  effective_meter numeric := 0;
  effective_completed_at timestamptz;
  effective_status public.work_order_final_status;
BEGIN
  effective_meter := GREATEST(COALESCE(NEW.execution_meter, 0), 0);
  effective_completed_at := COALESCE(NEW.completed_at, now());
  effective_status := COALESCE(NEW.final_status, 'concluida'::public.work_order_final_status);

  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    IF NEW.parts IS NOT NULL AND jsonb_array_length(NEW.parts) > 0 THEN
      FOR part_record IN SELECT * FROM jsonb_array_elements(NEW.parts)
      LOOP
        IF parts_text != '' THEN parts_text := parts_text || ', '; END IF;
        parts_text := parts_text || COALESCE(part_record->>'code', '');
        IF COALESCE(part_record->>'description', '') != '' THEN
          parts_text := parts_text || ' (' || (part_record->>'description') || ')';
        END IF;
        IF COALESCE(part_record->>'quantity', '') != '' THEN
          parts_text := parts_text || ' x' || (part_record->>'quantity');
        END IF;
      END LOOP;
    ELSE
      parts_text := COALESCE(NEW.part_code, 'N/A');
    END IF;

    UPDATE public.equipments e
    SET current_hour_meter = GREATEST(e.current_hour_meter, effective_meter),
        status = CASE
          WHEN COALESCE(NEW.machine_released, false) = true AND effective_status = 'concluida'::public.work_order_final_status THEN 'active'
          ELSE 'maintenance'
        END,
        updated_at = now()
    WHERE e.id = NEW.equipment_id;

    INSERT INTO public.maintenance_history (
      equipment_id,
      plan_id,
      description,
      hour_meter,
      executed_at,
      operator_name,
      notes,
      labor_cost,
      parts_cost
    )
    VALUES (
      NEW.equipment_id,
      NEW.maintenance_plan_id,
      'OS #' || NEW.os_number || ' - ' || COALESCE(NEW.description, 'Serviço executado'),
      effective_meter,
      effective_completed_at,
      COALESCE(NEW.mechanic_name, 'Mecânico'),
      concat_ws(
        E'\n',
        'Problema relatado: ' || COALESCE(NEW.description, '—'),
        'Causa identificada: ' || COALESCE(NEW.cause_identified, '—'),
        'Tipo de manutenção: ' || COALESCE(NEW.maintenance_type::text, '—'),
        'Serviços realizados: ' || COALESCE(NEW.service_executed, '—'),
        'Peças: ' || COALESCE(NULLIF(parts_text, ''), '—'),
        'Observações técnicas: ' || COALESCE(NEW.technical_observations, '—'),
        'Status final: ' || effective_status::text,
        'Máquina liberada: ' || CASE WHEN COALESCE(NEW.machine_released, false) THEN 'sim' ELSE 'não' END
      ),
      COALESCE(NEW.labor_cost, 0),
      COALESCE(NEW.parts_cost, 0)
    );

    IF NEW.maintenance_type = 'preventiva'::public.maintenance_execution_type
       AND NEW.maintenance_plan_id IS NOT NULL THEN
      UPDATE public.maintenance_plans mp
      SET last_done_at = GREATEST(COALESCE(mp.last_done_at, 0), effective_meter),
          next_due_at = GREATEST(COALESCE(mp.last_done_at, 0), effective_meter) + mp.interval_hours,
          status = 'ok',
          last_executed_at = effective_completed_at,
          updated_at = now()
      WHERE mp.id = NEW.maintenance_plan_id;
    END IF;
  END IF;

  IF OLD.status = 'done' AND NEW.status != 'done' THEN
    UPDATE public.maintenance_requests
    SET status = CASE WHEN NEW.status = 'in_progress' THEN 'in_progress' ELSE 'open' END,
        resolved_at = NULL
    WHERE id = NEW.maintenance_request_id AND status = 'done';

    UPDATE public.equipments
    SET status = 'maintenance',
        updated_at = now()
    WHERE id = NEW.equipment_id;
  END IF;

  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND OLD.status != 'done' THEN
    UPDATE public.maintenance_requests
    SET status = 'in_progress'
    WHERE id = NEW.maintenance_request_id AND status = 'open';

    UPDATE public.equipments
    SET status = 'maintenance',
        current_hour_meter = GREATEST(current_hour_meter, effective_meter),
        updated_at = now()
    WHERE id = NEW.equipment_id;
  END IF;

  RETURN NEW;
END;
$function$;