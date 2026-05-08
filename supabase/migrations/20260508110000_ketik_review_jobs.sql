-- Create ketik_review_jobs table for durable processing pipeline
CREATE TABLE IF NOT EXISTS public.ketik_review_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.ketik_history(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ketik_review_jobs
    ADD CONSTRAINT ketik_review_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'completed', 'failed'));

-- Ensure only one job per session
CREATE UNIQUE INDEX IF NOT EXISTS ketik_review_jobs_session_id_idx ON public.ketik_review_jobs(session_id);

CREATE INDEX IF NOT EXISTS ketik_review_jobs_claim_idx
    ON public.ketik_review_jobs (status, lease_expires_at, created_at);

-- Enable RLS
ALTER TABLE public.ketik_review_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own jobs
CREATE POLICY "Users can read their own ketik_review_jobs"
    ON public.ketik_review_jobs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ketik_history
            WHERE id = ketik_review_jobs.session_id
            AND user_id = auth.uid()
        )
    );

-- Allow service role to manage jobs for worker execution.
CREATE POLICY "Service role can manage ketik_review_jobs"
    ON public.ketik_review_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Keep ketik_history review lifecycle compatible with queue states.
ALTER TABLE public.ketik_history
    ALTER COLUMN review_status SET DEFAULT 'pending';

UPDATE public.ketik_history kh
SET review_status = 'failed'
WHERE kh.review_status = 'completed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ketik_session_reviews sr
    WHERE sr.session_id = kh.id
  );

ALTER TABLE public.ketik_history
    DROP CONSTRAINT IF EXISTS ketik_history_review_status_check;

ALTER TABLE public.ketik_history
    ADD CONSTRAINT ketik_history_review_status_check
    CHECK (review_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add updated_at trigger
DROP TRIGGER IF EXISTS ketik_review_jobs_updated_at ON public.ketik_review_jobs;
CREATE TRIGGER ketik_review_jobs_updated_at
    BEFORE UPDATE ON public.ketik_review_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
