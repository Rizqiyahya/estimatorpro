-- EstimatorPro: assign current user roles and make self-registration least-privilege.
-- New self-registered users are Managers by default. An administrator promotes
-- approved Estimators explicitly through the profiles table or a future admin UI.

-- Correct the seven currently registered accounts.
UPDATE public.profiles
SET role = CASE
  WHEN lower(email) IN (
    'rizqibinjafar14@gmail.com',
    'mahmud.yusuf14@gmail.com',
    'ecameidiana23@gmail.com'
  ) THEN 'estimator'
  ELSE 'manager'
END;

-- Keep direct database inserts consistent with the secure registration default.
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'manager';

-- Ignore any client-supplied role in auth metadata: self-registration always
-- creates a read-only Manager profile unless an administrator promotes it later.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'manager'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
