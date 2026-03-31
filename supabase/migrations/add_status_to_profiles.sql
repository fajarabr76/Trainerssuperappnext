-- Tambah kolom status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- PENTING: Set semua user yang sudah ada sebelumnya menjadi 'approved'
-- agar user lama tidak terkunci setelah migrasi dijalankan
UPDATE public.profiles 
SET status = 'approved' 
WHERE status = 'pending';

-- Mulai sekarang, pendaftar baru otomatis 'pending' (dari DEFAULT di atas)
