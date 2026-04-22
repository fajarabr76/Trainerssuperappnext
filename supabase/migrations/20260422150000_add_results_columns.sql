-- Add missing columns to the results table
-- This migration ensures the results table has the expected schema for dual-source history

-- Add details column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'details'
  ) THEN
    ALTER TABLE results ADD COLUMN details JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add history column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'history'
  ) THEN
    ALTER TABLE results ADD COLUMN history JSONB;
  END IF;
END $$;

-- Add module column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'module'
  ) THEN
    ALTER TABLE results ADD COLUMN module TEXT;
  END IF;
END $$;

-- Add score column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'score'
  ) THEN
    ALTER TABLE results ADD COLUMN score NUMERIC;
  END IF;
END $$;

-- Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE results ADD COLUMN user_id UUID;
  END IF;
END $$;

-- Add created_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE results ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_module ON results(module);
CREATE INDEX IF NOT EXISTS idx_results_user_module ON results(user_id, module);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON results(created_at DESC);
