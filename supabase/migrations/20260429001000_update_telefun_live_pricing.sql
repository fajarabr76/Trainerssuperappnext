-- Corrective upsert for gemini-3.1-flash-live-preview pricing.
--
-- This migration fixes environments where the model was previously seeded
-- with placeholder 0/0 or 3.50/6.00 rates. It applies the Telefun v1
-- audio-dominant blended rate because live sessions are primarily audio
-- input/output. The schema currently stores one blended rate per direction,
-- so these values serve as the default operational rates for Telefun voice.
--
-- Official Gemini Live pricing (text/image/video/audio are billed separately
-- by Google; we collapse them into a single blended rate for v1):
--   input text   $0.75 / 1M tokens
--   input audio  $3.00 / 1M tokens  ($0.005 / minute)
--   input image  $1.00 / 1M tokens  ($0.002 / minute)
--   output text  $4.50 / 1M tokens
--   output audio $12.00 / 1M tokens ($0.018 / minute)
--
-- For environments where updated_at exists, refresh it on conflict.
INSERT INTO ai_pricing_settings (model_id, input_price_usd_per_million, output_price_usd_per_million)
VALUES ('gemini-3.1-flash-live-preview', 3.00, 12.00)
ON CONFLICT (model_id) DO UPDATE SET
  input_price_usd_per_million = EXCLUDED.input_price_usd_per_million,
  output_price_usd_per_million = EXCLUDED.output_price_usd_per_million,
  updated_at = now();
