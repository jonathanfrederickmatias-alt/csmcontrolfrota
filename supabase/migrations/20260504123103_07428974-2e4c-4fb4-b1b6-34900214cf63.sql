-- Enable pgcrypto for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Hash existing plaintext PINs in place (column stays as 'pin' but stores bcrypt hash)
UPDATE public.fuel_pins
SET pin = crypt(pin, gen_salt('bf'))
WHERE pin IS NOT NULL AND pin NOT LIKE '$2%';

-- 2) Drop the dangerous public SELECT policy that exposed all PINs
DROP POLICY IF EXISTS "Public can read fuel_pins for validation" ON public.fuel_pins;

-- 3) Create a SECURITY DEFINER RPC that validates PIN without exposing the hash
-- Returns the user_id + tenant_id of matching PIN, or NULL row if invalid.
CREATE OR REPLACE FUNCTION public.verify_fuel_pin(input_pin text)
RETURNS TABLE(valid boolean, user_id uuid, tenant_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Basic input validation
  IF input_pin IS NULL OR length(btrim(input_pin)) < 4 OR length(btrim(input_pin)) > 12 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, fp.user_id, fp.tenant_id
  FROM public.fuel_pins fp
  WHERE fp.pin = crypt(btrim(input_pin), fp.pin)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid;
  END IF;
END;
$$;

-- Allow anon + authenticated to call the validator (it returns only boolean+ids, not the hash)
GRANT EXECUTE ON FUNCTION public.verify_fuel_pin(text) TO anon, authenticated;

-- 4) Make sure newly inserted PINs are hashed automatically
CREATE OR REPLACE FUNCTION public.hash_fuel_pin_on_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only hash when value is not already a bcrypt hash
  IF NEW.pin IS NOT NULL AND NEW.pin NOT LIKE '$2%' THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hash_fuel_pin_before_insert ON public.fuel_pins;
CREATE TRIGGER hash_fuel_pin_before_insert
BEFORE INSERT ON public.fuel_pins
FOR EACH ROW EXECUTE FUNCTION public.hash_fuel_pin_on_write();

DROP TRIGGER IF EXISTS hash_fuel_pin_before_update ON public.fuel_pins;
CREATE TRIGGER hash_fuel_pin_before_update
BEFORE UPDATE OF pin ON public.fuel_pins
FOR EACH ROW
WHEN (NEW.pin IS DISTINCT FROM OLD.pin)
EXECUTE FUNCTION public.hash_fuel_pin_on_write();