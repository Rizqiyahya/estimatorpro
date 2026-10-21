-- EstimatorPro — National Indonesia location master
-- Administrative hierarchy: Province → Regency/City → District (Kecamatan).
-- The data import is intentionally separated from this schema migration so it
-- can be executed in safe batches without exposing bulk-write access to users.

CREATE TABLE IF NOT EXISTS public.indonesia_locations (
  district_code TEXT PRIMARY KEY CHECK (district_code ~ '^[0-9]{2}\.[0-9]{2}\.[0-9]{2}$'),
  province_code TEXT NOT NULL CHECK (province_code ~ '^[0-9]{2}$'),
  province_name TEXT NOT NULL,
  regency_code TEXT NOT NULL CHECK (regency_code ~ '^[0-9]{2}\.[0-9]{2}$'),
  regency_name TEXT NOT NULL,
  district_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT indonesia_locations_unique_name_per_regency
    UNIQUE (regency_code, district_name)
);

CREATE INDEX IF NOT EXISTS idx_indonesia_locations_province
  ON public.indonesia_locations (province_code, regency_name, district_name);
CREATE INDEX IF NOT EXISTS idx_indonesia_locations_regency
  ON public.indonesia_locations (regency_code, district_name);
CREATE INDEX IF NOT EXISTS idx_indonesia_locations_search
  ON public.indonesia_locations (province_name, regency_name, district_name);

ALTER TABLE public.indonesia_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read Indonesia location master" ON public.indonesia_locations;
CREATE POLICY "Authenticated users can read Indonesia location master"
  ON public.indonesia_locations
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy is granted to application users. The canonical
-- import is performed by an administrator through a controlled migration/job.
REVOKE ALL ON TABLE public.indonesia_locations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.indonesia_locations TO authenticated;
