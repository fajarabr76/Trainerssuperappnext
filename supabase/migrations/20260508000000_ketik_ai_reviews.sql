-- Add new score columns to existing ketik_history
ALTER TABLE ketik_history 
ADD COLUMN IF NOT EXISTS final_score numeric(5,2),
ADD COLUMN IF NOT EXISTS empathy_score numeric(5,2),
ADD COLUMN IF NOT EXISTS probing_score numeric(5,2),
ADD COLUMN IF NOT EXISTS typo_score numeric(5,2),
ADD COLUMN IF NOT EXISTS compliance_score numeric(5,2),
ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending';

-- Create ketik_session_reviews table
CREATE TABLE IF NOT EXISTS ketik_session_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES ketik_history(id) ON DELETE CASCADE,
    ai_summary text,
    strengths jsonb DEFAULT '[]'::jsonb,
    weaknesses jsonb DEFAULT '[]'::jsonb,
    coaching_focus jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create ketik_typo_findings table for simple typo detection
CREATE TABLE IF NOT EXISTS ketik_typo_findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES ketik_history(id) ON DELETE CASCADE,
    message_id text NOT NULL,
    original_word text NOT NULL,
    corrected_word text NOT NULL,
    severity text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE ketik_session_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own session reviews" ON ketik_session_reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ketik_history
            WHERE ketik_history.id = ketik_session_reviews.session_id
            AND ketik_history.user_id = auth.uid()
        )
    );

ALTER TABLE ketik_typo_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own typo findings" ON ketik_typo_findings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ketik_history
            WHERE ketik_history.id = ketik_typo_findings.session_id
            AND ketik_history.user_id = auth.uid()
        )
    );
