-- Migration 20260509100000_correct_pricing_and_backfill.sql
-- Corrects text simulation model pricing and backfills current month logs with Rp0 cost.

-- 1. Corrective Upsert for Pricing
INSERT INTO ai_pricing_settings (model_id, input_price_usd_per_million, output_price_usd_per_million, updated_at)
VALUES 
  ('gemini-3.1-flash-lite', 0.10, 0.40, NOW()),
  ('gemini-2.0-flash-lite', 0.10, 0.40, NOW()),
  ('gemini-2.0-flash-preview-tts', 0.10, 0.40, NOW()),
  ('gemini-3.1-flash-live-preview', 3.0, 12.0, NOW()),
  ('openai/gpt-oss-120b:free', 0.0, 0.0, NOW()),
  ('google/gemini-3.1-flash-lite', 0.10, 0.40, NOW()),
  ('google/gemini-2.0-flash-lite', 0.10, 0.40, NOW()),
  ('openai/gpt-4o-mini', 0.15, 0.60, NOW()),
  ('qwen/qwen3.5-flash-02-23', 0.10, 0.40, NOW())
ON CONFLICT (model_id) 
DO UPDATE SET 
  input_price_usd_per_million = EXCLUDED.input_price_usd_per_million,
  output_price_usd_per_million = EXCLUDED.output_price_usd_per_million,
  updated_at = EXCLUDED.updated_at;

-- 2. Limited Backfill for Current Month (WIB)
-- Current month is May 2026.
DO $$
DECLARE
  current_month_start TIMESTAMPTZ;
  latest_rate NUMERIC;
BEGIN
  -- Calculate start of current month in WIB, converted to UTC
  -- date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta') gives 2026-05-01 00:00:00
  -- Then we say this is in 'Asia/Jakarta' and convert to UTC.
  current_month_start := (date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::text || ' Asia/Jakarta')::timestamptz;
  
  -- Get latest USD to IDR rate
  SELECT usd_to_idr_rate INTO latest_rate FROM ai_billing_settings ORDER BY created_at DESC LIMIT 1;
  IF latest_rate IS NULL THEN latest_rate := 15000; END IF;

  -- Update logs that have 0 cost but have tokens and a pricing model exists
  UPDATE ai_usage_logs l
  SET 
    input_price_usd_per_million = p.input_price_usd_per_million,
    output_price_usd_per_million = p.output_price_usd_per_million,
    usd_to_idr_rate = latest_rate,
    estimated_cost_usd = ((l.input_tokens::NUMERIC / 1000000.0) * p.input_price_usd_per_million) + 
                         ((l.output_tokens::NUMERIC / 1000000.0) * p.output_price_usd_per_million),
    estimated_cost_idr = ROUND((((l.input_tokens::NUMERIC / 1000000.0) * p.input_price_usd_per_million) + 
                                ((l.output_tokens::NUMERIC / 1000000.0) * p.output_price_usd_per_million)) * latest_rate)
  FROM ai_pricing_settings p
  WHERE l.model_id = p.model_id
    AND l.estimated_cost_idr = 0
    AND (l.input_tokens > 0 OR l.output_tokens > 0)
    AND l.created_at >= current_month_start;
END $$;
