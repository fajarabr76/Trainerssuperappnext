-- Report Maker v1.1: reports table + storage bucket policies
-- Run in Supabase SQL editor if bucket insert fails due to permissions.

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('layanan', 'individu')),
  service_type TEXT,
  peserta_id UUID REFERENCES public.profiler_peserta(id) ON DELETE SET NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  ai_model_used TEXT NOT NULL,
  ai_provider TEXT NOT NULL DEFAULT 'openrouter',
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed', 'expired')),
  error_message TEXT,
  file_url TEXT,
  file_size_bytes INT,
  processing_time_ms INT,
  downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_cleanup ON public.reports(status, downloaded_at)
  WHERE status = 'completed' AND downloaded_at IS NOT NULL;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers can view all reports" ON public.reports;
CREATE POLICY "Trainers can view all reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('trainer', 'trainers', 'admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Service role can manage reports" ON public.reports;
CREATE POLICY "Service role can manage reports" ON public.reports
  FOR ALL USING (auth.role() = 'service_role');

-- Storage bucket (ignore error if already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Trainers can download reports" ON storage.objects;
CREATE POLICY "Trainers can download reports" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('trainer', 'trainers', 'admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Service role manages report files" ON storage.objects;
CREATE POLICY "Service role manages report files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'reports'
    AND auth.role() = 'service_role'
  );
