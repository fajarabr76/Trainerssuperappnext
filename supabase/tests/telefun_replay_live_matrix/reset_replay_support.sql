\set ON_ERROR_STOP on

DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB);

DROP TABLE IF EXISTS public.telefun_replay_annotations CASCADE;
DROP TABLE IF EXISTS public.telefun_coaching_summary CASCADE;

ALTER TABLE public.telefun_history
  DROP COLUMN IF EXISTS session_duration_ms,
  DROP COLUMN IF EXISTS voice_dashboard_metrics,
  DROP COLUMN IF EXISTS disruption_config,
  DROP COLUMN IF EXISTS disruption_results,
  DROP COLUMN IF EXISTS persona_config,
  DROP COLUMN IF EXISTS realistic_mode_enabled;
