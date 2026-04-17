-- Remove legacy superadmin role and consolidate all elevated access under admin.
-- This also ensures fajarabr76@gmail.com has full admin access.

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(COALESCE(role, '')) = 'superadmin';

UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(COALESCE(email, '')) = 'fajarabr76@gmail.com';

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (
  lower(role) = ANY (ARRAY['trainer'::text, 'trainers'::text, 'leader'::text, 'agent'::text, 'admin'::text])
);

DROP POLICY IF EXISTS "weights_write_auth" ON public.qa_service_weights;
CREATE POLICY "weights_write_auth" ON public.qa_service_weights
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer', 'trainers')
    )
  );

DROP POLICY IF EXISTS "Trainers can view all reports" ON public.reports;
CREATE POLICY "Trainers can view all reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('trainer', 'trainers', 'admin')
    )
  );

DROP POLICY IF EXISTS "Trainers can download reports" ON storage.objects;
CREATE POLICY "Trainers can download reports" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('trainer', 'trainers', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.bulk_reorder_profiler_peserta(p_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_total_rows integer;
  v_distinct_ids integer;
  v_distinct_order_numbers integer;
  v_updated_rows integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT lower(coalesce(role, ''))
  INTO v_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_role NOT IN ('trainer', 'trainers', 'admin') THEN
    RAISE EXCEPTION 'Akses ditolak: role tidak memiliki izin untuk reorder peserta';
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' OR jsonb_array_length(p_updates) = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT id)
  INTO v_total_rows, v_distinct_ids
  FROM jsonb_to_recordset(p_updates) AS u(id uuid, nomor_urut integer);

  IF v_total_rows <> v_distinct_ids THEN
    RAISE EXCEPTION 'Payload reorder mengandung id duplikat';
  END IF;

  SELECT COUNT(DISTINCT nomor_urut)
  INTO v_distinct_order_numbers
  FROM jsonb_to_recordset(p_updates) AS u(id uuid, nomor_urut integer);

  IF v_total_rows <> v_distinct_order_numbers THEN
    RAISE EXCEPTION 'Payload reorder mengandung nomor_urut duplikat';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_updates) AS u(id uuid, nomor_urut integer)
    WHERE u.id IS NULL OR u.nomor_urut IS NULL OR u.nomor_urut < 1
  ) THEN
    RAISE EXCEPTION 'Payload reorder tidak valid';
  END IF;

  UPDATE public.profiler_peserta AS p
  SET nomor_urut = u.nomor_urut
  FROM jsonb_to_recordset(p_updates) AS u(id uuid, nomor_urut integer)
  WHERE p.id = u.id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows <> v_total_rows THEN
    RAISE EXCEPTION 'Sebagian data reorder tidak ditemukan atau tidak ter-update';
  END IF;
END;
$$;
