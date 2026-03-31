-- Index untuk optimasi query getConsolidatedPeriodData & RPC
-- Filter utama: tahun + period_id + service_type + peserta_id

CREATE INDEX IF NOT EXISTS idx_qa_temuan_tahun
  ON public.qa_temuan (tahun);

CREATE INDEX IF NOT EXISTS idx_qa_temuan_period_id
  ON public.qa_temuan (period_id);

CREATE INDEX IF NOT EXISTS idx_qa_temuan_service_type
  ON public.qa_temuan (service_type);

CREATE INDEX IF NOT EXISTS idx_qa_temuan_peserta_id
  ON public.qa_temuan (peserta_id);

CREATE INDEX IF NOT EXISTS idx_qa_temuan_composite
  ON public.qa_temuan (tahun, service_type, period_id, peserta_id);

CREATE INDEX IF NOT EXISTS idx_qa_temuan_nilai
  ON public.qa_temuan (nilai);
