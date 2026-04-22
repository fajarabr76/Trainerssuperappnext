-- Fix NOT NULL constraints on results table columns
-- These columns should be nullable since data is stored inside details/history JSONB

-- Make scenario_title nullable
DO $$
BEGIN
  -- Check if column exists and has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'scenario_title'
  ) THEN
    ALTER TABLE results ALTER COLUMN scenario_title DROP NOT NULL;
  END IF;
END $$;

-- Make consumer_name nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'consumer_name'
  ) THEN
    ALTER TABLE results ALTER COLUMN consumer_name DROP NOT NULL;
  END IF;
END $$;

-- Make consumer_phone nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'consumer_phone'
  ) THEN
    ALTER TABLE results ALTER COLUMN consumer_phone DROP NOT NULL;
  END IF;
END $$;

-- Make consumer_city nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'consumer_city'
  ) THEN
    ALTER TABLE results ALTER COLUMN consumer_city DROP NOT NULL;
  END IF;
END $$;

-- Make messages nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'messages'
  ) THEN
    ALTER TABLE results ALTER COLUMN messages DROP NOT NULL;
  END IF;
END $$;

-- Make date nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'date'
  ) THEN
    ALTER TABLE results ALTER COLUMN date DROP NOT NULL;
  END IF;
END $$;

-- Make score nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'score'
  ) THEN
    ALTER TABLE results ALTER COLUMN score DROP NOT NULL;
  END IF;
END $$;

-- Make module nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'module'
  ) THEN
    ALTER TABLE results ALTER COLUMN module DROP NOT NULL;
  END IF;
END $$;

-- Make user_id nullable (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE results ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;
