-- EstimatorPro — One-time EP Code normalization and permanent monthly ledger
-- Purpose:
--   1. Close historical EP-number gaps while no external documents reference them.
--   2. Keep the approved future policy: codes are immutable and never reused.
--
-- Existing code is normalized per registered month (YYYYMM), ordered by
-- created_at then id. The migration runs atomically while requests is locked,
-- so no concurrent request can receive a code during the renumbering.

BEGIN;

LOCK TABLE public.requests IN ACCESS EXCLUSIVE MODE;

-- Keep a durable allocator rather than deriving the next code from MAX().
-- This prevents reusing a code when the highest-numbered request is deleted.
CREATE TABLE IF NOT EXISTS public.request_tender_code_sequences (
  month_key TEXT PRIMARY KEY CHECK (month_key ~ '^[0-9]{6}$'),
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0 AND last_number <= 9999),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.request_tender_code_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.request_tender_code_sequences FROM PUBLIC, anon, authenticated;

-- EP Code is intentionally immutable in normal operation. Disable its trigger
-- only for this one controlled, transactional historical normalization.
ALTER TABLE public.requests DISABLE TRIGGER set_request_tender_code;
DROP INDEX IF EXISTS public.idx_requests_tender_code_unique;

-- The CHECK constraint only allows canonical EP values, therefore it is
-- temporarily removed while unique TMP_<uuid> placeholders are used.
ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_tender_code_format_check;

-- Capture the existing registration month before codes are temporarily moved.
-- A valid old EP Code remains in its original printed month; rows without one
-- fall back to the Jakarta month from created_at.
CREATE TEMP TABLE ep_code_normalization_map ON COMMIT DROP AS
SELECT
  id,
  COALESCE(
    substring(tender_code FROM '^EP_([0-9]{6})_[0-9]{4}$'),
    to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYYMM')
  ) AS month_key,
  created_at
FROM public.requests;

-- First move every code to a unique temporary value. This avoids transient
-- unique-index collisions when a dense renumbering changes, for example,
-- EP_202610_0002 into EP_202610_0001.
UPDATE public.requests
   SET tender_code = 'TMP_' || id::TEXT;

-- Restore canonical, dense EP codes per original registration month.
WITH numbered AS (
  SELECT
    id,
    month_key,
    row_number() OVER (
      PARTITION BY month_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS sequence_number
  FROM ep_code_normalization_map
)
UPDATE public.requests AS r
   SET tender_code = 'EP_' || n.month_key || '_' || lpad(n.sequence_number::TEXT, 4, '0')
  FROM numbered AS n
 WHERE r.id = n.id;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_tender_code_format_check
  CHECK (tender_code ~ '^EP_[0-9]{6}_[0-9]{4}$');

CREATE UNIQUE INDEX idx_requests_tender_code_unique
  ON public.requests(tender_code);

ALTER TABLE public.requests ENABLE TRIGGER set_request_tender_code;

-- Set/repair the ledger at the final number now in use for every month.
INSERT INTO public.request_tender_code_sequences (month_key, last_number, updated_at)
SELECT
  substring(tender_code FROM '^EP_([0-9]{6})_[0-9]{4}$') AS month_key,
  max((substring(tender_code FROM '([0-9]{4})$'))::INTEGER) AS last_number,
  now()
FROM public.requests
GROUP BY 1
ON CONFLICT (month_key) DO UPDATE
  SET last_number = EXCLUDED.last_number,
      updated_at = EXCLUDED.updated_at;

-- Every future code is allocated from the ledger. A database row lock created
-- by this UPSERT guarantees a unique number even for parallel inserts.
CREATE OR REPLACE FUNCTION public.generate_request_tender_code(p_registered_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_month_key TEXT := to_char(COALESCE(p_registered_at, now()) AT TIME ZONE 'Asia/Jakarta', 'YYYYMM');
  v_next_number INTEGER;
BEGIN
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

-- Retain server-only access to code allocation and trigger implementation.
REVOKE ALL ON FUNCTION public.generate_request_tender_code(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_immutable_request_tender_code() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Post-run verification (optional):
-- SELECT substring(tender_code FROM '^EP_([0-9]{6})_') AS month_key,
--        count(*) AS request_count,
--        min(tender_code) AS first_code,
--        max(tender_code) AS last_code,
--        max((substring(tender_code FROM '([0-9]{4})$'))::integer) AS last_number
-- FROM public.requests
-- GROUP BY 1
-- ORDER BY 1;
