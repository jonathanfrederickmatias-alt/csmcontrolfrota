CREATE OR REPLACE FUNCTION public.admin_create_user_in_tenant(
  _email text,
  _password text,
  _display_name text,
  _role public.app_role,
  _tenant_id uuid,
  _pin text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar usuários';
  END IF;

  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'E-mail é obrigatório';
  END IF;
  IF _password IS NULL OR length(_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 6 caracteres';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(btrim(_email))) THEN
    RAISE EXCEPTION 'Já existe um usuário com este e-mail';
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    lower(btrim(_email)),
    crypt(_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('display_name', COALESCE(_display_name, _email)),
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', lower(btrim(_email))),
    'email',
    lower(btrim(_email)),
    now(), now(), now()
  );

  -- handle_new_user trigger já criou o profile no tenant default; movemos para o correto
  UPDATE public.profiles
  SET tenant_id = _tenant_id,
      display_name = COALESCE(_display_name, _email)
  WHERE user_id = new_user_id;

  -- Caso o trigger não tenha rodado, garante o profile
  INSERT INTO public.profiles (user_id, display_name, tenant_id)
  SELECT new_user_id, COALESCE(_display_name, _email), _tenant_id
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = new_user_id);

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (new_user_id, _role, _tenant_id);

  IF _role = 'abastecedor'::public.app_role THEN
    INSERT INTO public.fuel_pins (user_id, pin, tenant_id)
    VALUES (new_user_id, COALESCE(_pin, '1234'), _tenant_id);
  END IF;

  RETURN new_user_id;
END;
$$;