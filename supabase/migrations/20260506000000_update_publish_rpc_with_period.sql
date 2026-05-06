-- migration: supabase/migrations/20260506000000_update_publish_rpc_with_period.sql

CREATE OR REPLACE FUNCTION public.publish_rule_version(
  p_version_id uuid,
  p_change_reason text,
  p_effective_period_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record qa_service_rule_versions%ROWTYPE;
  v_service_type text;
  v_target_period_id uuid;
  v_old_published qa_service_rule_versions%ROWTYPE;
  v_actor uuid;
  v_next_version integer;
BEGIN
  v_actor := auth.uid();

  -- 0. Permission check
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor
      AND role IN ('admin', 'trainer', 'trainers')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 1. Lock & fetch draft
  SELECT * INTO v_record FROM qa_service_rule_versions
  WHERE id = p_version_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Draft not found');
  END IF;

  v_service_type := v_record.service_type;
  -- Use provided period or fallback to draft's current period
  v_target_period_id := COALESCE(p_effective_period_id, v_record.effective_period_id);

  -- 2. Validate no duplicate indicators
  IF EXISTS (
    SELECT 1 FROM qa_service_rule_indicators
    WHERE rule_version_id = p_version_id
    GROUP BY lower(trim(name)), category
    HAVING COUNT(*) > 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ada parameter duplikat dalam kategori yang sama');
  END IF;

  -- 3. Scoring-mode-aware validation
  IF v_record.scoring_mode = 'weighted' THEN
    IF v_record.critical_weight > 0 AND NOT EXISTS (
      SELECT 1 FROM qa_service_rule_indicators
      WHERE rule_version_id = p_version_id AND category = 'critical'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Parameter critical wajib ada');
    END IF;

    IF v_record.non_critical_weight > 0 AND NOT EXISTS (
      SELECT 1 FROM qa_service_rule_indicators
      WHERE rule_version_id = p_version_id AND category = 'non_critical'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Parameter non-critical wajib ada');
    END IF;

    IF EXISTS (
      SELECT 1 FROM (
        SELECT category, SUM(bobot) as total
        FROM qa_service_rule_indicators
        WHERE rule_version_id = p_version_id AND category IN ('critical', 'non_critical')
        GROUP BY category
        HAVING ABS(SUM(bobot) - 1.0) > 0.001
      ) x
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bobot per kategori tidak 100%');
    END IF;
  END IF;

  -- 4. Authoritative check for conflicting draft in target period
  IF EXISTS (
    SELECT 1 FROM qa_service_rule_versions
    WHERE service_type = v_service_type
      AND effective_period_id = v_target_period_id
      AND status = 'draft'
      AND id != p_version_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Periode target sudah memiliki draft lain. Hapus draft tersebut terlebih dahulu.');
  END IF;

  -- 5. Find existing published version for target period
  SELECT * INTO v_old_published FROM qa_service_rule_versions
  WHERE service_type = v_service_type
    AND effective_period_id = v_target_period_id
    AND status = 'published'
  FOR UPDATE;

  -- 6. Conflict Check: Don't allow publishing to a period that already has a published version
  -- UNLESS the draft itself was already pointing to this period (standard revision).
  IF v_old_published.id IS NOT NULL AND v_record.effective_period_id != v_target_period_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Periode target sudah memiliki versi Published. Silakan gunakan flow "Buat Revisi" dari periode tersebut.');
  END IF;

  -- 7. Mandatory change_reason check
  -- Rule: Required if created_from_version_id is set (it's a revision)
  IF v_record.created_from_version_id IS NOT NULL AND (p_change_reason IS NULL OR trim(p_change_reason) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alasan revisi wajib diisi');
  END IF;

  -- 8. Calculate next version_number for target period
  IF v_record.effective_period_id = v_target_period_id THEN
    -- If publishing to the same period, keep the draft's version number
    v_next_version := v_record.version_number;
  ELSE
    -- If moving to a new period, get the next number for that period
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM qa_service_rule_versions
    WHERE service_type = v_service_type
      AND effective_period_id = v_target_period_id;
  END IF;

  -- 9. Supersede old published version if exists
  IF v_old_published.id IS NOT NULL THEN
    UPDATE qa_service_rule_versions
    SET status = 'superseded',
        superseded_at = now(),
        superseded_by = v_actor,
        superseded_by_version_id = p_version_id,
        updated_at = now()
    WHERE id = v_old_published.id;
  END IF;

  -- 10. Publish the draft with updated period and version_number
  UPDATE qa_service_rule_versions
  SET status = 'published',
      effective_period_id = v_target_period_id,
      version_number = v_next_version,
      published_by = v_actor,
      published_at = now(),
      change_reason = p_change_reason,
      updated_at = now()
  WHERE id = p_version_id;

  RETURN jsonb_build_object(
    'success', true, 
    'superseded_version_id', v_old_published.id,
    'new_version_number', v_next_version,
    'effective_period_id', v_target_period_id
  );
END;
$$;
