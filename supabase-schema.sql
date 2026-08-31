-- ============================================================
-- EstimatorPro — Supabase Database Schema
-- Run in Supabase SQL Editor after creating project
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (synced from auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'estimator' CHECK (role IN ('estimator', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- REQUESTS
-- ============================================================
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  no_id INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  subject TEXT NOT NULL DEFAULT '',
  email_by TEXT NOT NULL DEFAULT '',
  request_by TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  end_user TEXT NOT NULL DEFAULT '',
  division TEXT NOT NULL DEFAULT 'NETCO' CHECK (division IN ('NETCO', 'OMG', 'ITSOL')),
  scope_pl BOOLEAN NOT NULL DEFAULT false,
  scope_ps BOOLEAN NOT NULL DEFAULT false,
  scope_ms BOOLEAN NOT NULL DEFAULT false,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'win', 'lose')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  subject_request TEXT NOT NULL DEFAULT '',
  subject_task TEXT NOT NULL DEFAULT '',
  request_by TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  end_user TEXT NOT NULL DEFAULT '',
  scope_pl BOOLEAN NOT NULL DEFAULT false,
  scope_ps BOOLEAN NOT NULL DEFAULT false,
  scope_ms BOOLEAN NOT NULL DEFAULT false,
  location TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('High', 'Normal')),
  pipeline_status TEXT NOT NULL DEFAULT 'todo' CHECK (pipeline_status IN ('todo', 'in_progress', 'review', 'done', 'revisi')),
  boq_link TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '' CHECK (category IN ('', 'boq', 'planning', 'sto')),
  pipeline_history JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ESTIMATES
-- ============================================================
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  item TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'utama' CHECK (category IN ('utama', 'material', 'jasa', 'ms')),
  quantity NUMERIC DEFAULT NULL,
  unit TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC DEFAULT NULL,
  total_price NUMERIC DEFAULT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WBS (Work Breakdown Structure)
-- Hierarchy: Level 1 (Fase) → Level 2 (Deliverable) → Level 3 (Aktivitas)
-- Aktivitas (L3) with start_date + duration_days → feeds Gantt Chart
-- ============================================================
CREATE TABLE public.wbs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.wbs(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3)),
  name TEXT NOT NULL DEFAULT '',
  start_date DATE,
  duration_days INT,
  seq INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance index for frequently-queried foreign key
CREATE INDEX idx_wbs_task_id ON public.wbs(task_id);
CREATE INDEX idx_wbs_parent_id ON public.wbs(parent_id);

-- RLS: Estimator full access, Manager read-only
ALTER TABLE public.wbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimator full access" ON public.wbs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'));
CREATE POLICY "Manager read only" ON public.wbs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- Enable realtime for WBS (live Kanban-style updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.wbs;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_requests_division ON public.requests(division);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_created_by ON public.requests(created_by);
CREATE INDEX idx_tasks_request_id ON public.tasks(request_id);
CREATE INDEX idx_tasks_pipeline_status ON public.tasks(pipeline_status);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_estimates_task_id ON public.estimates(task_id);

-- Menjaga waktu perubahan untuk mekanisme merge offline/cloud.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wbs_updated_at BEFORE UPDATE ON public.wbs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Requests
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimator full access" ON public.requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'));
CREATE POLICY "Manager read only" ON public.requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimator full access" ON public.tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'));
CREATE POLICY "Manager read only" ON public.tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- Estimates
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimator full access" ON public.estimates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'estimator'));
CREATE POLICY "Manager read only" ON public.estimates FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- ============================================================
-- ENABLE REALTIME (for Kanban live updates)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;

-- ============================================================
-- MIGRATION: Run this if you already have the tables created
-- (adds pipeline_history and category columns)
-- ============================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS pipeline_history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.wbs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Jalankan bagian trigger ini juga pada project yang tabelnya sudah ada sebelum
-- schema versi ini diterapkan.
DROP TRIGGER IF EXISTS update_requests_updated_at ON public.requests;
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_estimates_updated_at ON public.estimates;
CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_wbs_updated_at ON public.wbs;
CREATE TRIGGER update_wbs_updated_at BEFORE UPDATE ON public.wbs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Jika category pernah dibuat tanpa constraint, jalankan bagian berikut setelah
-- menormalisasi data kategori lama menjadi boq/planning/sto atau string kosong.
-- ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
-- ALTER TABLE public.tasks ADD CONSTRAINT tasks_category_check
--   CHECK (category IN ('', 'boq', 'planning', 'sto'));
