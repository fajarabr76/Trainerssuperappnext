-- Seed pricing for Gemini Flash Lite models used in simulations
INSERT INTO ai_pricing_settings (model_id, input_price_usd_per_million, output_price_usd_per_million, created_at, updated_at)
VALUES 
  ('gemini-3.1-flash-lite', 0.10, 0.40, NOW(), NOW()),
  ('gemini-2.0-flash-lite', 0.10, 0.40, NOW(), NOW())
ON CONFLICT (model_id) 
DO NOTHING;
