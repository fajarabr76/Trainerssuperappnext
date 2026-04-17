-- 1. Cek nama policy lama (opsional, untuk verifikasi manual)
-- SELECT policyname FROM pg_policies WHERE tablename = 'qa_temuan';

-- 2. Drop policy lama yang memberikan akses tulis ke Leader
-- Nama policy ini biasanya "Trainer/Leader can manage findings" jika mengikuti pola sebelumnya
DROP POLICY IF EXISTS "Trainer/Leader can manage findings" ON public.qa_temuan;

-- 3. Policy baru untuk Trainer dan admin (Akses Penuh)
CREATE POLICY "Trainer can manage findings" 
ON public.qa_temuan FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Trainer', 'admin')
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Trainer', 'admin')
);

-- 4. Policy baru untuk Leader (Hanya Baca / SELECT)
CREATE POLICY "Leader can view all findings" 
ON public.qa_temuan FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Leader'
);
