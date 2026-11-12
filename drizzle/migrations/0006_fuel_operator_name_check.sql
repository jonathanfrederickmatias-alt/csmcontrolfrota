CREATE OR REPLACE FUNCTION public.validate_fuel_operator_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.operator_name ~ '^\s*[0-9]' AND (TG_OP = 'INSERT' OR NEW.operator_name IS DISTINCT FROM OLD.operator_name) THEN
    RAISE EXCEPTION 'O campo Operador deve conter apenas o nome (sem km/horímetro).';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_fuel_operator_name BEFORE INSERT OR UPDATE ON public.fuel_records
FOR EACH ROW EXECUTE FUNCTION public.validate_fuel_operator_name();