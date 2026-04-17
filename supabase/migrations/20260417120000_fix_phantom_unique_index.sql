-- Fix: previous unique partial index blocked inserting 5 phantom padding sessions
-- for one participant/period/service because all rows share the same tuple.

DROP INDEX IF EXISTS public.uq_qa_temuan_single_phantom_batch_per_period;

-- Keep a non-unique helper index for faster idempotency checks/filtering.
CREATE INDEX IF NOT EXISTS idx_qa_temuan_phantom_lookup
  ON public.qa_temuan (peserta_id, period_id, service_type)
  WHERE is_phantom_padding = true;
