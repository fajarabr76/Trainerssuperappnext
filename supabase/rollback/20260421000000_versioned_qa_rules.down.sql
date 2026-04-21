-- Rollback for versioned_qa_rules migration

-- ① Remove columns from qa_temuan
ALTER TABLE public.qa_temuan
  DROP COLUMN IF EXISTS rule_version_id,
  DROP COLUMN IF EXISTS rule_indicator_id;

-- ② Drop tables
DROP TABLE IF EXISTS public.qa_service_rule_indicators;
DROP TABLE IF EXISTS public.qa_service_rule_versions;
