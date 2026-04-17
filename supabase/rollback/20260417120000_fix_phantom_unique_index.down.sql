-- Rollback for 20260417120000_fix_phantom_unique_index.sql

DROP INDEX IF EXISTS public.idx_qa_temuan_phantom_lookup;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_temuan_single_phantom_batch_per_period
  ON public.qa_temuan (peserta_id, period_id, service_type)
  WHERE is_phantom_padding = true;
