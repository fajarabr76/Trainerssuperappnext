-- Create results table if it doesn't exist
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  score NUMERIC,
  details JSONB DEFAULT '{}'::jsonb,
  history JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own results" ON results;
DROP POLICY IF EXISTS "Users can view their own results" ON results;
DROP POLICY IF EXISTS "Users can delete their own results" ON results;

-- Users can insert their own results
CREATE POLICY "Users can insert their own results"
  ON results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own results
CREATE POLICY "Users can view their own results"
  ON results
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own results
CREATE POLICY "Users can delete their own results"
  ON results
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_results_updated_at ON results;
CREATE TRIGGER update_results_updated_at
  BEFORE UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_module ON results(module);
CREATE INDEX IF NOT EXISTS idx_results_user_module ON results(user_id, module);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON results(created_at DESC);
