-- Hapus policy lama yang terlalu permisif
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own pending profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display name" ON public.profiles;

-- User biasa hanya boleh membuat profil sendiri dalam status pending.
-- Ini menutup jalur self-provisioning langsung ke role/status privileged.
CREATE POLICY "Users can insert own pending profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND lower(coalesce(status, 'pending')) = 'pending'
  AND lower(coalesce(role, 'agent')) IN ('agent', 'leader', 'trainer', 'agents', 'trainers')
  AND lower(coalesce(role, 'agent')) <> 'admin'
  AND coalesce(is_deleted, false) = false
);

-- Buat policy baru: user hanya boleh update full_name pada baris sendiri
CREATE POLICY "Users can update own display name"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- RLS tidak membatasi kolom update, jadi kunci juga privilege kolom.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- Tambahan: buat fungsi trigger untuk mencegah perubahan kolom sensitif
CREATE OR REPLACE FUNCTION public.prevent_self_role_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika user mengubah baris sendiri (bukan service role)
  IF auth.uid() = NEW.id THEN
    -- Paksa role dan status tetap sama dengan nilai lama
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.is_deleted := OLD.is_deleted;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER guard_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_status_change();
