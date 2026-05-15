-- Extend telefun_history with realistic mode columns
-- Requirements: 7.1 (voice dashboard metrics), 8.1 (disruption config/results), 6.1 (persona config)

ALTER TABLE telefun_history
  ADD COLUMN IF NOT EXISTS voice_dashboard_metrics JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disruption_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disruption_results JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS persona_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS realistic_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Comments for documentation
COMMENT ON COLUMN telefun_history.voice_dashboard_metrics IS 'VoiceDashboardMetrics computed post-session (speechClarity, speakingSpeed, speakingDominance, intonationVariability)';
COMMENT ON COLUMN telefun_history.disruption_config IS 'DisruptionType[] enabled for this session (1-3 types)';
COMMENT ON COLUMN telefun_history.disruption_results IS 'DisruptionInstance[] outcomes from the session';
COMMENT ON COLUMN telefun_history.persona_config IS '{personaType, initialIntensity, finalIntensity} persona configuration';
COMMENT ON COLUMN telefun_history.realistic_mode_enabled IS 'Whether realistic mode was active for this session';
