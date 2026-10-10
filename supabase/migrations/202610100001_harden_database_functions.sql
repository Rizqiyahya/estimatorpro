-- EstimatorPro: harden database helper functions
-- Apply through Supabase SQL Editor or Supabase CLI.
-- This migration is idempotent and does not modify application data.

-- Prevent search_path manipulation in trigger/helper functions.
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
    'estimator'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- These functions are invoked by database triggers/admin automation only;
-- they must not be callable through the public Data API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- The current production project also has public.rls_auto_enable(). If that
-- administrative helper is retained, run these statements after confirming its
-- exact signature in the SQL Editor:
-- ALTER FUNCTION public.rls_auto_enable() SET search_path = public;
-- REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
