import { SessionConfig } from '@/app/types';
import type { ConsumerPersonaType, DisruptionType } from './realisticMode/types';
import { RealisticModeConfig } from './realisticMode/RealisticModeOrchestrator';

const CONSUMER_TYPE_TO_PERSONA: Record<string, ConsumerPersonaType> = {
  marah: 'angry',
  bingung: 'confused',
  kritis: 'critical',
  ramah: 'cooperative',
  'terburu-buru': 'rushed',
  pasrah: 'passive',
};

const FALLBACK_PERSONA: ConsumerPersonaType = 'cooperative';

const VALID_DISRUPTION_TYPES: readonly DisruptionType[] = [
  'technical_term_confusion',
  'repeated_question',
  'misunderstanding',
  'interruption',
  'incomplete_data',
  'unclear_voice',
  'emotional_escalation',
];

function resolvePersonaType(consumerTypeId: string): ConsumerPersonaType {
  return CONSUMER_TYPE_TO_PERSONA[consumerTypeId] ?? FALLBACK_PERSONA;
}

function resolveDisruptionTypes(raw?: string[]): DisruptionType[] {
  if (!raw) return [];
  const valid = raw.filter((t): t is DisruptionType =>
    VALID_DISRUPTION_TYPES.includes(t as DisruptionType)
  );
  return valid.slice(0, 3);
}

export function resolveTelefunRealisticModeConfig(config: SessionConfig): RealisticModeConfig {
  if (!config.realisticModeEnabled) {
    return { enabled: false, personaType: FALLBACK_PERSONA };
  }

  return {
    enabled: true,
    personaType: resolvePersonaType(config.consumerType.id),
    disruptionTypes: resolveDisruptionTypes(config.realisticModeDisruptionTypes),
  };
}
