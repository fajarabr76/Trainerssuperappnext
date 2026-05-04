-- Add unique index on qa_temuan to prevent duplicate input at DB level.
-- Covers: same peserta + period + service + ticket (trimmed, lowercased) + indicator.
-- Excludes: phantom padding rows and empty/whitespace-only tickets (app skips duplicate check for those).
--
-- PRE-DEPLOYMENT CHECK: verify there are no existing duplicate rows that would block index creation:
--   SELECT peserta_id, period_id, service_type, LOWER(TRIM(no_tiket)), indicator_id, COUNT(*)
--   FROM public.qa_temuan
--   WHERE is_phantom_padding = false AND no_tiket IS NOT NULL AND TRIM(no_tiket) != ''
--   GROUP BY 1,2,3,4,5 HAVING COUNT(*) > 1;
-- If this query returns rows, cleanup duplicates before running this migration.
-- See supabase/maintenance/qa_temuan_duplicate_input_cleanup.sql for review queries
-- and a non-destructive cleanup template.

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_temuan_duplicate_input
  ON public.qa_temuan (peserta_id, period_id, service_type, LOWER(TRIM(no_tiket)), indicator_id)
  WHERE is_phantom_padding = false AND no_tiket IS NOT NULL AND TRIM(no_tiket) != '';
