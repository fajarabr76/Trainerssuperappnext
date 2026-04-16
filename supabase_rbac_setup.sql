-- 1. Create Tables

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'Agent' CHECK (role IN ('Trainer', 'Leader', 'Agent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Results Table
CREATE TABLE IF NOT EXISTS public.results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  module TEXT NOT NULL, -- 'ketik', 'pdkt', 'telefun'
  scenario_title TEXT NOT NULL,
  score INTEGER NOT NULL,
  feedback TEXT,
  history JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Profiler Years Table
CREATE TABLE IF NOT EXISTS public.profiler_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Profiler Folders Table
CREATE TABLE IF NOT EXISTS public.profiler_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  year_id UUID REFERENCES public.profiler_years(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.profiler_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Profiler Peserta Table
CREATE TABLE IF NOT EXISTS public.profiler_peserta (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  batch_name TEXT REFERENCES public.profiler_folders(name) ON DELETE CASCADE NOT NULL,
  tim TEXT NOT NULL,
  jabatan TEXT NOT NULL,
  nama TEXT NOT NULL,
  foto_url TEXT,
  photo_frame JSONB,
  bergabung_date DATE,
  nik_ojk TEXT,
  email_ojk TEXT,
  no_telepon TEXT,
  no_telepon_darurat TEXT,
  nama_kontak_darurat TEXT,
  hubungan_kontak_darurat TEXT,
  jenis_kelamin TEXT,
  agama TEXT,
  tgl_lahir DATE,
  status_perkawinan TEXT,
  pendidikan TEXT,
  no_ktp TEXT,
  no_npwp TEXT,
  nomor_rekening TEXT,
  nama_bank TEXT,
  alamat_tinggal TEXT,
  status_tempat_tinggal TEXT,
  nama_lembaga TEXT,
  jurusan TEXT,
  previous_company TEXT,
  pengalaman_cc TEXT,
  catatan_tambahan TEXT,
  keterangan TEXT,
  nomor_urut INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Profiler Tim List Table
CREATE TABLE IF NOT EXISTS public.profiler_tim_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_tim_list ENABLE ROW LEVEL SECURITY;

-- 3. Helper Functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Policies for 'profiles' table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Trainers can view all profiles" ON public.profiles;
CREATE POLICY "Trainers can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.get_auth_role() = 'Trainer');

DROP POLICY IF EXISTS "Leaders can view all profiles" ON public.profiles;
CREATE POLICY "Leaders can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.get_auth_role() = 'Leader');

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 5. Policies for 'results' table
DROP POLICY IF EXISTS "Users can view own results" ON public.results;
CREATE POLICY "Users can view own results" 
ON public.results FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Trainers can view all results" ON public.results;
CREATE POLICY "Trainers can view all results" 
ON public.results FOR SELECT 
USING (public.get_auth_role() = 'Trainer');

DROP POLICY IF EXISTS "Leaders can view all results" ON public.results;
CREATE POLICY "Leaders can view all results" 
ON public.results FOR SELECT 
USING (public.get_auth_role() = 'Leader');

DROP POLICY IF EXISTS "Users can insert own results" ON public.results;
CREATE POLICY "Users can insert own results" 
ON public.results FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 6. Policies for 'profiler' tables (Folders, Peserta, Tim List, Years)
-- Restricted to Trainers and Leaders

DROP POLICY IF EXISTS "Trainers and Leaders can manage years" ON public.profiler_years;
CREATE POLICY "Trainers and Leaders can manage years" 
ON public.profiler_years FOR ALL 
USING (LOWER(public.get_auth_role()) IN ('trainer', 'leader'));

DROP POLICY IF EXISTS "Trainers and Leaders can manage folders" ON public.profiler_folders;
CREATE POLICY "Trainers and Leaders can manage folders" 
ON public.profiler_folders FOR ALL 
USING (LOWER(public.get_auth_role()) IN ('trainer', 'leader'));

DROP POLICY IF EXISTS "Trainers and Leaders can manage peserta" ON public.profiler_peserta;
CREATE POLICY "Trainers and Leaders can manage peserta" 
ON public.profiler_peserta FOR ALL 
USING (LOWER(public.get_auth_role()) IN ('trainer', 'leader'));

DROP POLICY IF EXISTS "Trainers and Leaders can manage tim list" ON public.profiler_tim_list;
CREATE POLICY "Trainers and Leaders can manage tim list" 
ON public.profiler_tim_list FOR ALL 
USING (LOWER(public.get_auth_role()) IN ('trainer', 'leader'));

-- 6. Storage Setup (profiler-foto bucket)

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'profiler-foto', 'profiler-foto', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profiler-foto'
);

-- Policy: Allow public to read files
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read for Profiler" ON storage.objects;
CREATE POLICY "Public Read for Profiler"
ON storage.objects FOR SELECT
USING ( bucket_id = 'profiler-foto' );

-- Policy: Allow Trainers and Leaders to manage files (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Trainer and Leader Upload" ON storage.objects;
DROP POLICY IF EXISTS "Trainer and Leader Update" ON storage.objects;
DROP POLICY IF EXISTS "Trainer and Leader Delete" ON storage.objects;
DROP POLICY IF EXISTS "Manage Profiler Foto" ON storage.objects;
CREATE POLICY "Manage Profiler Foto"
ON storage.objects FOR ALL
USING (
  bucket_id = 'profiler-foto' AND
  LOWER(public.get_auth_role()) IN ('trainer', 'leader')
)
WITH CHECK (
  bucket_id = 'profiler-foto' AND
  LOWER(public.get_auth_role()) IN ('trainer', 'leader')
);
