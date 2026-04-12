DO $$
BEGIN
  IF to_regclass('public.pdkt_history') IS NULL THEN
    RAISE EXCEPTION 'Migration requires public.pdkt_history to exist before adding async evaluation columns';
  END IF;

  ALTER TABLE public.pdkt_history
    ADD COLUMN IF NOT EXISTS evaluation_status text NOT NULL DEFAULT 'processing',
    ADD COLUMN IF NOT EXISTS evaluation_error text,
    ADD COLUMN IF NOT EXISTS evaluation_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS evaluation_completed_at timestamptz;

  ALTER TABLE public.pdkt_history
    DROP CONSTRAINT IF EXISTS pdkt_history_evaluation_status_check;

  ALTER TABLE public.pdkt_history
    ADD CONSTRAINT pdkt_history_evaluation_status_check
    CHECK (evaluation_status IN ('processing', 'completed', 'failed'));

  CREATE INDEX IF NOT EXISTS idx_pdkt_history_user_timestamp
    ON public.pdkt_history (user_id, timestamp DESC);

  CREATE INDEX IF NOT EXISTS idx_pdkt_history_evaluation_status
    ON public.pdkt_history (evaluation_status);

  -- Legacy rows that already have evaluation payload are considered finished.
  UPDATE public.pdkt_history
  SET
    evaluation_status = 'completed',
    evaluation_completed_at = COALESCE(evaluation_completed_at, timestamp),
    evaluation_error = NULL
  WHERE evaluation IS NOT NULL
    AND evaluation_status = 'processing';

  -- Legacy rows without evaluation payload should not appear as "still processing".
  UPDATE public.pdkt_history
  SET
    evaluation_status = 'failed',
    evaluation_error = COALESCE(evaluation_error, 'Evaluasi historis tidak tersedia untuk sesi lama.'),
    evaluation_completed_at = COALESCE(evaluation_completed_at, timestamp)
  WHERE evaluation IS NULL
    AND evaluation_status = 'processing';
END $$;

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

  IF v_role NOT IN ('trainer', 'trainers', 'admin', 'superadmin') THEN
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

GRANT EXECUTE ON FUNCTION public.bulk_reorder_profiler_peserta(jsonb) TO authenticated;
