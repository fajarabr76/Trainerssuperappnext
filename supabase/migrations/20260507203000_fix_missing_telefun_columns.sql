-- Add missing columns to telefun_history that were defined in 20260428000000 but not applied to prod
ALTER TABLE telefun_history
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Update comment
COMMENT ON TABLE telefun_history IS 'Stores history of Telefun voice simulations for each user, including scoring and assessment.';
