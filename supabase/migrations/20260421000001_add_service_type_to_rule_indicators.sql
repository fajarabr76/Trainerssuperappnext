-- Migration: Add service_type to qa_service_rule_indicators
ALTER TABLE public.qa_service_rule_indicators 
  ADD COLUMN IF NOT EXISTS service_type text;

-- Populate service_type from parent rule_versions
UPDATE public.qa_service_rule_indicators i
SET service_type = v.service_type
FROM public.qa_service_rule_versions v
WHERE i.rule_version_id = v.id;

-- Make it NOT NULL after population
ALTER TABLE public.qa_service_rule_indicators 
  ALTER COLUMN service_type SET NOT NULL;
