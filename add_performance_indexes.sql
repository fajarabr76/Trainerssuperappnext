-- Performance indexes for SIDAK (QA Analyzer)

-- 1. Expanded Composite Index for Trend Calculations
-- Many queries filter by agent (peserta_id), year (tahun), and service_type
CREATE INDEX IF NOT EXISTS idx_qa_temuan_peserta_tahun_service 
ON public.qa_temuan (peserta_id, tahun, service_type);

-- 2. Index for indicator joins (Foreign Key index)
-- Improving performance of JOIN with qa_indicators
CREATE INDEX IF NOT EXISTS idx_qa_temuan_indicator_id 
ON public.qa_temuan (indicator_id);

-- 3. Composite Index for filtered agent list (Commonly used in dashboard/rankings)
-- Filters by trainer_id and jabatan are frequent for role-based views
CREATE INDEX IF NOT EXISTS idx_profiler_peserta_trainer_jabatan 
ON public.profiler_peserta (trainer_id, jabatan);

-- 4. Composite Index for batch & team filtering
CREATE INDEX IF NOT EXISTS idx_profiler_peserta_batch_tim 
ON public.profiler_peserta (batch_name, tim);

-- 5. Composite Index for qa_findings (Used in summary/legacy views)
CREATE INDEX IF NOT EXISTS idx_qa_findings_peserta_period 
ON public.qa_findings (peserta_id, period_id);
