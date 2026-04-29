-- Placeholder pricing for gemini-3.1-flash-live-preview.
--
-- Telefun v1 uses an audio-dominant blended rate because live sessions
-- consist primarily of audio input and audio output. The current schema
-- stores only one blended rate per direction, so input text instructions,
-- image/video frames, and output text/thinking are not billed separately.
-- Admin MUST verify against the latest official pricing and update via
-- the pricing editor if the blended rate no longer reflects usage patterns.
--
-- Official Gemini Live pricing (per modality, not per direction):
--   input text   $0.75 / 1M tokens
--   input audio  $3.00 / 1M tokens  ($0.005 / minute)
--   input image  $1.00 / 1M tokens  ($0.002 / minute)
--   output text  $4.50 / 1M tokens
--   output audio $12.00 / 1M tokens ($0.018 / minute)
--
-- Default operational rate for Telefun voice live (audio-dominant):
--   input  $3.00 / 1M tokens
--   output $12.00 / 1M tokens
INSERT INTO ai_pricing_settings (model_id, input_price_usd_per_million, output_price_usd_per_million)
VALUES ('gemini-3.1-flash-live-preview', 3.00, 12.00)
ON CONFLICT (model_id) DO NOTHING;
