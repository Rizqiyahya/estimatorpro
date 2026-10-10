-- EstimatorPro — Immutable request/tender code
-- Canonical format: EP_YYYYMM_NNNN
-- `YYYYMM` is the Jakarta registration month and `NNNN` resets monthly.

BEGIN;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS tender_code TEXT;


CREATE TABLE IF NOT EXISTS public.request_tender_code_sequences (
  month_key TEXT PRIMARY KEY CHECK (month_key ~ '^[0-9]{6}$'),
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0 AND last_number <= 9999),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.request_tender_code_sequences ENABLE ROW LEVEL SECURITY;

-- No client ever needs direct access to the sequence table. Code allocation occurs
-- only inside the protected database function below.
REVOKE ALL ON TABLE public.request_tender_code_sequences FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_request_tender_code(p_registered_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_month_key TEXT;
  v_next_number INTEGER;
BEGIN
  v_month_key := to_char(timezone('Asia/Jakarta', COALESCE(p_registered_at, now())), 'YYYYMM');

  INSERT INTO public.request_tender_code_sequences (month_key, last_number, updated_at)
  VALUES (v_month_key, 1, now())
  ON CONFLICT (month_key) DO UPDATE
    SET last_number = public.request_tender_code_sequences.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_next_number;

  IF v_next_number > 9999 THEN
    RAISE EXCEPTION 'Tender-code monthly capacity exceeded for %', v_month_key;
  END IF;

  RETURN 'EP_' || v_month_key || '_' || lpad(v_next_number::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_request_tender_code(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_immutable_request_tender_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Ignore any code supplied from the browser: the database exclusively owns it.
    NEW.tender_code := public.generate_request_tender_code(now());
  ELSIF OLD.tender_code IS NOT NULL AND NEW.tender_code IS DISTINCT FROM OLD.tender_code THEN
    RAISE EXCEPTION 'Tender code is immutable';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_immutable_request_tender_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_request_tender_code ON public.requests;
CREATE TRIGGER set_request_tender_code
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_immutable_request_tender_code();

-- Backfill historical records in one dedicated legacy registration month.
-- This preserves the canonical rule that the YYYYMM part represents the month
-- in which EstimatorPro officially registered the code, not an imported date.
DO $$
DECLARE
  v_request RECORD;
  v_backfill_at TIMESTAMPTZ := now();
BEGIN
  FOR v_request IN
    SELECT id
    FROM public.requests
    WHERE tender_code IS NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE public.requests
    SET tender_code = public.generate_request_tender_code(v_backfill_at)
    WHERE id = v_request.id;
  END LOOP;
END;
$$;

ALTER TABLE public.requests
  ALTER COLUMN tender_code SET NOT NULL;

ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_tender_code_format_check;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_tender_code_format_check
  CHECK (tender_code ~ '^EP_[0-9]{6}_[0-9]{4}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_tender_code_unique
  ON public.requests(tender_code);

COMMIT;
