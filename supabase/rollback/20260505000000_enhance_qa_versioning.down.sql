-- Rollback: QA versioning enhancement
-- Date: 2026-05-05

-- Safe rollback (non-destructive — keeps audit columns)
DROP FUNCTION IF EXISTS public.publish_rule_version(uuid, text);

DROP INDEX IF EXISTS uq_qa_rule_version_number;
DROP INDEX IF EXISTS uq_qa_rule_one_published_per_service_period;
DROP INDEX IF EXISTS uq_qa_rule_one_draft_per_service_period;

ALTER TABLE qa_service_rule_versions
  DROP CONSTRAINT IF EXISTS qa_service_rule_versions_status_check;

ALTER TABLE qa_service_rule_versions
  ADD CONSTRAINT qa_service_rule_versions_status_check
  CHECK (status IN ('draft', 'published'));

-- NOTE: Do NOT drop audit columns in production rollback.
-- The columns below are preserved for data integrity.
-- version_number, change_reason, updated_by, superseded_at,
-- superseded_by, superseded_by_version_id, created_from_version_id

-- Destructive rollback (dev/staging only — uncomment if needed):
-- ALTER TABLE qa_service_rule_versions
--   DROP COLUMN IF EXISTS version_number,
--   DROP COLUMN IF EXISTS change_reason,
--   DROP COLUMN IF EXISTS updated_by,
--   DROP COLUMN IF EXISTS superseded_at,
--   DROP COLUMN IF EXISTS superseded_by,
--   DROP COLUMN IF EXISTS superseded_by_version_id,
--   DROP COLUMN IF EXISTS created_from_version_id;
-- ALTER TABLE qa_service_rule_indicators
--   DROP COLUMN IF EXISTS updated_by;
