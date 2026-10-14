-- ============================================================
-- EstimatorPro — Repair EP Code generation and timezone handling
-- Run this migration once in the Supabase SQL Editor.
-- ============================================================
--
-- EP Code is a registration identifier, not the Date Received field.
-- Therefore its YYYYMM portion is calculated on PostgreSQL using
-- Asia/Jakarta consistently, regardless of the browser/device timezone.

CREATE OR REPLACE FUNCTION public.generate_request_tender_code(p_registered_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month TEXT := to_char(p_registered_at AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');
  v_sequence INTEGER;
BEGIN
  -- Serialize issuance for the same Jakarta calendar month to prevent
  -- duplicate sequence numbers when several users create requests together.
  PERFORM pg_advisory_xact_lock(hashtext('estimatorpro:tender-code:' || v_month));

  SELECT COALESCE(MAX((substring(tender_code FROM '([0-9]{4})$'))::INTEGER), 0) + 1
    INTO v_sequence
    FROM public.requests
   WHERE tender_code LIKE 'EP_' || v_month || '_%';

  RETURN 'EP_' || v_month || '_' || lpad(v_sequence::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_immutable_request_tender_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.tender_code IS NULL OR btrim(NEW.tender_code) = '') THEN
    NEW.tender_code := public.generate_request_tender_code(now());
  ELSIF TG_OP = 'UPDATE' AND OLD.tender_code IS NOT NULL
        AND NEW.tender_code IS DISTINCT FROM OLD.tender_code THEN
    RAISE EXCEPTION 'Tender code is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_request_tender_code ON public.requests;
CREATE TRIGGER set_request_tender_code
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_immutable_request_tender_code();

-- Reissue only blank legacy codes. Existing EP codes stay permanent.
UPDATE public.requests
   SET tender_code = public.generate_request_tender_code(now())
 WHERE tender_code IS NULL OR btrim(tender_code) = '';

ALTER TABLE public.requests
  ALTER COLUMN tender_code SET NOT NULL;

-- A defensive RPC for rows inserted while the original trigger was absent.
-- It returns the final code and leaves established codes untouched.
REVOKE ALL ON FUNCTION public.generate_request_tender_code(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_immutable_request_tender_code() FROM PUBLIC, anon, authenticated;
