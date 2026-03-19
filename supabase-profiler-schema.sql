-- =================================================================================
-- SCHEMA UNTUK MODUL PROFILER PESERTA
-- Jalankan script ini di SQL Editor Supabase Anda.
-- =================================================================================

-- 1. Tabel profiler_years
CREATE TABLE IF NOT EXISTS public.profiler_years (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year integer NOT NULL UNIQUE,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel profiler_folders
CREATE TABLE IF NOT EXISTS public.profiler_folders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    trainer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    year_id uuid REFERENCES public.profiler_years(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES public.profiler_folders(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel profiler_peserta
CREATE TABLE IF NOT EXISTS public.profiler_peserta (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    batch_name text REFERENCES public.profiler_folders(name) ON DELETE CASCADE ON UPDATE CASCADE NOT NULL,
    nomor_urut integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Identitas
    nama text NOT NULL,
    tim text NOT NULL,
    jabatan text NOT NULL,
    foto_url text,
    
    -- Data Kerja
    nik_ojk text,
    bergabung_date date,
    email_ojk text,
    no_telepon text,
    no_telepon_darurat text,
    nama_kontak_darurat text,
    hubungan_kontak_darurat text,
    
    -- Data Pribadi
    jenis_kelamin text,
    agama text,
    tgl_lahir date,
    status_perkawinan text,
    pendidikan text,
    
    -- Data Sensitif
    no_ktp text,
    no_npwp text,
    nomor_rekening text,
    nama_bank text,
    alamat_tinggal text,
    status_tempat_tinggal text,
    
    -- Latar Belakang
    nama_lembaga text,
    jurusan text,
    previous_company text,
    pengalaman_cc text,
    
    -- Catatan
    catatan_tambahan text,
    keterangan text
);

-- 4. Tabel profiler_tim_list
CREATE TABLE IF NOT EXISTS public.profiler_tim_list (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nama text NOT NULL UNIQUE,
    trainer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =================================================================================
-- ROW LEVEL SECURITY (RLS)
-- =================================================================================

-- Aktifkan RLS
ALTER TABLE public.profiler_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_tim_list ENABLE ROW LEVEL SECURITY;

-- Policy untuk profiler_years
CREATE POLICY "Trainer can view own years" ON public.profiler_years FOR SELECT USING (true);
CREATE POLICY "Trainer can insert own years" ON public.profiler_years FOR INSERT WITH CHECK (true);
CREATE POLICY "Trainer can update own years" ON public.profiler_years FOR UPDATE USING (true);
CREATE POLICY "Trainer can delete own years" ON public.profiler_years FOR DELETE USING (true);

-- Policy untuk profiler_folders
CREATE POLICY "Trainer can view own folders" ON public.profiler_folders FOR SELECT USING (auth.uid() = trainer_id);
CREATE POLICY "Trainer can insert own folders" ON public.profiler_folders FOR INSERT WITH CHECK (auth.uid() = trainer_id);
CREATE POLICY "Trainer can update own folders" ON public.profiler_folders FOR UPDATE USING (auth.uid() = trainer_id);
CREATE POLICY "Trainer can delete own folders" ON public.profiler_folders FOR DELETE USING (auth.uid() = trainer_id);

-- Policy untuk profiler_peserta
CREATE POLICY "Trainer can view own peserta" ON public.profiler_peserta FOR SELECT USING (auth.uid() = trainer_id);
CREATE POLICY "Trainer can insert own peserta" ON public.profiler_peserta FOR INSERT WITH CHECK (auth.uid() = trainer_id);
CREATE POLICY "Trainer can update own peserta" ON public.profiler_peserta FOR UPDATE USING (auth.uid() = trainer_id);
CREATE POLICY "Trainer can delete own peserta" ON public.profiler_peserta FOR DELETE USING (auth.uid() = trainer_id);

-- Policy untuk profiler_tim_list
CREATE POLICY "Trainer can view own tim list" ON public.profiler_tim_list FOR SELECT USING (auth.uid() = trainer_id);
CREATE POLICY "Trainer can insert own tim list" ON public.profiler_tim_list FOR INSERT WITH CHECK (auth.uid() = trainer_id);
CREATE POLICY "Trainer can update own tim list" ON public.profiler_tim_list FOR UPDATE USING (auth.uid() = trainer_id);
CREATE POLICY "Trainer can delete own tim list" ON public.profiler_tim_list FOR DELETE USING (auth.uid() = trainer_id);

-- =================================================================================
-- STORAGE BUCKET
-- =================================================================================
-- Pastikan Anda membuat bucket bernama 'profiler-foto' di Supabase Storage
-- dan mengatur public access policy agar foto dapat diakses.
--
-- SQL untuk Storage (jika diizinkan oleh Supabase SQL Editor):
-- insert into storage.buckets (id, name, public) values ('profiler-foto', 'profiler-foto', true);
-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'profiler-foto' );
-- create policy "Auth Insert" on storage.objects for insert with check ( bucket_id = 'profiler-foto' and auth.role() = 'authenticated' );
-- create policy "Auth Update" on storage.objects for update using ( bucket_id = 'profiler-foto' and auth.role() = 'authenticated' );
-- create policy "Auth Delete" on storage.objects for delete using ( bucket_id = 'profiler-foto' and auth.role() = 'authenticated' );
