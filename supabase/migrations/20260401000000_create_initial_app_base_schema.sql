-- Initial app base schema.
--
-- Fresh Supabase local databases apply only tracked migrations. Older setup
-- scripts/manual SQL created these foundational objects, but later migrations
-- already depend on them. Keep this migration idempotent so existing databases
-- can safely no-op when the objects already exist.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'agent'
    CONSTRAINT profiles_role_check
    CHECK (lower(role) IN ('admin', 'trainer', 'trainers', 'leader', 'agent', 'agents')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(coalesce(role, '')) FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role;

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  module text,
  type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.profiler_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE CHECK (year BETWEEN 2000 AND 2100),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiler_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  year_id uuid REFERENCES public.profiler_years(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profiler_folders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiler_peserta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_name text NOT NULL REFERENCES public.profiler_folders(name) ON DELETE CASCADE ON UPDATE CASCADE,
  nomor_urut integer NOT NULL DEFAULT 0,
  nama text NOT NULL,
  tim text NOT NULL,
  jabatan text NOT NULL,
  foto_url text,
  photo_frame jsonb,
  nik_ojk text,
  bergabung_date date,
  email_ojk text,
  no_telepon text,
  no_telepon_darurat text,
  nama_kontak_darurat text,
  hubungan_kontak_darurat text,
  jenis_kelamin text,
  agama text,
  tgl_lahir date,
  status_perkawinan text,
  pendidikan text,
  no_ktp text,
  no_npwp text,
  nomor_rekening text,
  nama_bank text,
  alamat_tinggal text,
  status_tempat_tinggal text,
  nama_lembaga text,
  jurusan text,
  previous_company text,
  pengalaman_cc text,
  catatan_tambahan text,
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiler_tim_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE,
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiler_peserta_batch_name ON public.profiler_peserta(batch_name);
CREATE INDEX IF NOT EXISTS idx_profiler_peserta_tim ON public.profiler_peserta(tim);

DROP TRIGGER IF EXISTS update_profiler_peserta_updated_at ON public.profiler_peserta;
CREATE TRIGGER update_profiler_peserta_updated_at
  BEFORE UPDATE ON public.profiler_peserta
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ketik_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date timestamptz NOT NULL DEFAULT now(),
  scenario_title text NOT NULL,
  consumer_name text NOT NULL,
  consumer_phone text,
  consumer_city text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ketik_history_user_date
  ON public.ketik_history(user_id, date DESC);

CREATE TABLE IF NOT EXISTS public.pdkt_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluation jsonb,
  time_taken integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdkt_history_user_timestamp
  ON public.pdkt_history(user_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS public.qa_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

CREATE TABLE IF NOT EXISTS public.qa_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'non_critical'
    CONSTRAINT qa_indicators_category_check
    CHECK (category IN ('critical', 'non_critical')),
  bobot numeric NOT NULL DEFAULT 0,
  has_na boolean NOT NULL DEFAULT false,
  threshold numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_type, name)
);

CREATE TABLE IF NOT EXISTS public.qa_temuan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id uuid NOT NULL REFERENCES public.profiler_peserta(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.qa_periods(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES public.qa_indicators(id) ON DELETE RESTRICT,
  service_type text NOT NULL,
  no_tiket text,
  nilai integer NOT NULL CHECK (nilai BETWEEN 0 AND 3),
  ketidaksesuaian text,
  sebaiknya text,
  tahun integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_indicators_service_type ON public.qa_indicators(service_type);
CREATE INDEX IF NOT EXISTS idx_qa_temuan_period_service ON public.qa_temuan(period_id, service_type);
CREATE INDEX IF NOT EXISTS idx_qa_temuan_peserta_period ON public.qa_temuan(peserta_id, period_id);
CREATE INDEX IF NOT EXISTS idx_qa_temuan_indicator_id ON public.qa_temuan(indicator_id);

DROP TRIGGER IF EXISTS update_qa_indicators_updated_at ON public.qa_indicators;
CREATE TRIGGER update_qa_indicators_updated_at
  BEFORE UPDATE ON public.qa_indicators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_qa_temuan_updated_at ON public.qa_temuan;
CREATE TRIGGER update_qa_temuan_updated_at
  BEFORE UPDATE ON public.qa_temuan
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_tim_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ketik_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdkt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_temuan ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon, public;
REVOKE ALL ON public.activity_logs FROM anon, public;
REVOKE ALL ON public.user_settings FROM anon, public;
REVOKE ALL ON public.profiler_years FROM anon, public;
REVOKE ALL ON public.profiler_folders FROM anon, public;
REVOKE ALL ON public.profiler_peserta FROM anon, public;
REVOKE ALL ON public.profiler_tim_list FROM anon, public;
REVOKE ALL ON public.ketik_history FROM anon, public;
REVOKE ALL ON public.pdkt_history FROM anon, public;
REVOKE ALL ON public.qa_periods FROM anon, public;
REVOKE ALL ON public.qa_indicators FROM anon, public;
REVOKE ALL ON public.qa_temuan FROM anon, public;

GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_years TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_peserta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_tim_list TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ketik_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdkt_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_indicators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_temuan TO authenticated;

GRANT ALL ON public.activity_logs TO service_role;
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.profiler_years TO service_role;
GRANT ALL ON public.profiler_folders TO service_role;
GRANT ALL ON public.profiler_peserta TO service_role;
GRANT ALL ON public.profiler_tim_list TO service_role;
GRANT ALL ON public.ketik_history TO service_role;
GRANT ALL ON public.pdkt_history TO service_role;
GRANT ALL ON public.qa_periods TO service_role;
GRANT ALL ON public.qa_indicators TO service_role;
GRANT ALL ON public.qa_temuan TO service_role;

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(required_table, ', ')
  INTO v_missing
  FROM (
    VALUES
      ('public.profiles'),
      ('public.activity_logs'),
      ('public.user_settings'),
      ('public.profiler_years'),
      ('public.profiler_folders'),
      ('public.profiler_peserta'),
      ('public.profiler_tim_list'),
      ('public.ketik_history'),
      ('public.pdkt_history'),
      ('public.qa_periods'),
      ('public.qa_indicators'),
      ('public.qa_temuan')
  ) AS t(required_table)
  WHERE to_regclass(required_table) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Initial app base schema incomplete. Missing: %', v_missing;
  END IF;
END $$;
