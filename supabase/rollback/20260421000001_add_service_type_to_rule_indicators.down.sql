-- Rollback: remove service_type from qa_service_rule_indicators
ALTER TABLE public.qa_service_rule_indicators
  DROP COLUMN IF EXISTS service_type;
