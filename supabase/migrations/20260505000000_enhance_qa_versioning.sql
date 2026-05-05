-- Migration: Enhance QA versioning with revision support
-- Date: 2026-05-05

-- 1. Drop old status check, add superseded
ALTER TABLE qa_service_rule_versions
  DROP CONSTRAINT IF EXISTS qa_service_rule_versions_status_check;

ALTER TABLE qa_service_rule_versions
  ADD CONSTRAINT qa_service_rule_versions_status_check
  CHECK (status IN ('draft', 'published', 'superseded'));

-- 2. Add columns as nullable first (safe for existing data)
ALTER TABLE qa_service_rule_versions
  ADD COLUMN IF NOT EXISTS version_number integer,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_by_version_id uuid REFERENCES qa_service_rule_versions(id),
  ADD COLUMN IF NOT EXISTS created_from_version_id uuid REFERENCES qa_service_rule_versions(id);

ALTER TABLE qa_service_rule_indicators
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 3. Backfill version_number safely using CTE
WITH numbered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY service_type, effective_period_id
           ORDER BY created_at, id
         ) as rn
  FROM qa_service_rule_versions
)
UPDATE qa_service_rule_versions
SET version_number = numbered.rn
FROM numbered
WHERE qa_service_rule_versions.id = numbered.id;

-- 4. Set NOT NULL after backfill (all rows should now have a value)
ALTER TABLE qa_service_rule_versions
  ALTER COLUMN version_number SET NOT NULL;

-- 5. Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_rule_version_number
ON qa_service_rule_versions (service_type, effective_period_id, version_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_rule_one_published_per_service_period
ON qa_service_rule_versions (service_type, effective_period_id)
WHERE status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_rule_one_draft_per_service_period
ON qa_service_rule_versions (service_type, effective_period_id)
WHERE status = 'draft';

-- 6. Atomic publish RPC
CREATE OR REPLACE FUNCTION public.publish_rule_version(
  p_version_id uuid,
  p_change_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record qa_service_rule_versions%ROWTYPE;
  v_service_type text;
  v_period_id uuid;
  v_old_published qa_service_rule_versions%ROWTYPE;
  v_actor uuid;
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
  v_period_id := v_record.effective_period_id;

  -- 2. Validate no duplicate indicator names within the same category
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

  -- 4. Find existing published version for this service + period
  SELECT * INTO v_old_published FROM qa_service_rule_versions
  WHERE service_type = v_service_type
    AND effective_period_id = v_period_id
    AND status = 'published'
    AND id != p_version_id
  FOR UPDATE;

  -- 5. If replacing an old published version, change_reason is required
  IF v_old_published.id IS NOT NULL AND (p_change_reason IS NULL OR trim(p_change_reason) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alasan revisi wajib diisi');
  END IF;

  -- 6. Supersede old published version
  IF v_old_published.id IS NOT NULL THEN
    UPDATE qa_service_rule_versions
    SET status = 'superseded',
        superseded_at = now(),
        superseded_by = v_actor,
        superseded_by_version_id = p_version_id,
        updated_at = now()
    WHERE id = v_old_published.id;
  END IF;

  -- 7. Publish the draft
  UPDATE qa_service_rule_versions
  SET status = 'published',
      published_by = v_actor,
      published_at = now(),
      change_reason = p_change_reason,
      updated_at = now()
  WHERE id = p_version_id;

  RETURN jsonb_build_object('success', true, 'superseded_version_id', v_old_published.id);
END;
$$;
