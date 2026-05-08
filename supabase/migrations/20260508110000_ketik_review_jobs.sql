-- Create ketik_review_jobs table for durable processing pipeline
CREATE TABLE IF NOT EXISTS public.ketik_review_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.ketik_history(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    leased_until TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one job per session
CREATE UNIQUE INDEX IF NOT EXISTS ketik_review_jobs_session_id_idx ON public.ketik_review_jobs(session_id);

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

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER ketik_review_jobs_updated_at
    BEFORE UPDATE ON public.ketik_review_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
