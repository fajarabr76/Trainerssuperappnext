-- Create telefun_history table
CREATE TABLE IF NOT EXISTS telefun_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT now(),
  scenario_title TEXT NOT NULL,
  consumer_name TEXT NOT NULL,
  consumer_phone TEXT,
  consumer_city TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE telefun_history ENABLE ROW LEVEL SECURITY;

-- Users can insert their own telefun history
CREATE POLICY "Users can insert their own telefun history"
  ON telefun_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own telefun history
CREATE POLICY "Users can view their own telefun history"
  ON telefun_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own telefun history
CREATE POLICY "Users can delete their own telefun history"
  ON telefun_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_telefun_history_user_id ON telefun_history(user_id);
CREATE INDEX IF NOT EXISTS idx_telefun_history_date ON telefun_history(date DESC);

-- Add comment to table
COMMENT ON TABLE telefun_history IS 'Stores history of Telefun voice simulations for each user.';
