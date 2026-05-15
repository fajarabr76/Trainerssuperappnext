/**
 * Persona State Machine - Pure Function Guard
 *
 * Maintains consistent consumer personality with emotional intensity tracking
 * throughout a simulation session. The persona type is immutable once initialized;
 * only emotional intensity changes in response to conversational events.
 *
 * Key behaviors:
 * - Persona type NEVER changes after initialization
 * - Emotional intensity bounded to [1, 10]
 * - De-escalation: intensity decreases by 1-2 (delta in [-2, 0])
 * - Escalation for angry/critical: intensity increases by 2-3
 * - Escalation for passive/cooperative: intensity increases by 1-2
 * - Escalation for confused/rushed: intensity increases by 1-2
 * - Language patterns generated based on persona type and intensity level
 *
 * @module personaStateMachine
 */

import type { ConsumerPersonaType, PersonaLanguagePatterns } from './types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PersonaState {
  personaType: ConsumerPersonaType;
  emotionalIntensity: number; // 1-10
  exchangeCount: number;
  lastDeEscalationAt: number | null;
  lastEscalationAt: number | null;
}

export type PersonaEvent =
  | { type: 'de_escalation'; trigger: 'empathy' | 'solution' | 'apology' }
  | { type: 'escalation'; trigger: 'dismissive' | 'ignored_concern' | 'rude_hold' }
  | { type: 'exchange_complete' }
  | { type: 'resolution_offered'; addressesConcern: boolean };

export interface PersonaResult {
  state: PersonaState;
  intensityDelta: number;
  languagePatterns: PersonaLanguagePatterns;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Initial emotional intensity ranges per persona type.
 * Used by initializePersona to set the starting intensity.
 */
const INTENSITY_RANGES: Record<ConsumerPersonaType, { min: number; max: number }> = {
  angry: { min: 7, max: 8 },
  critical: { min: 6, max: 7 },
  confused: { min: 4, max: 5 },
  rushed: { min: 5, max: 6 },
  passive: { min: 3, max: 4 },
  cooperative: { min: 2, max: 3 },
};

/** Minimum emotional intensity (floor). */
const MIN_INTENSITY = 1;

/** Maximum emotional intensity (ceiling). */
const MAX_INTENSITY = 10;

// ---------------------------------------------------------------------------
// Language Pattern Definitions (Indonesian)
// ---------------------------------------------------------------------------

/**
 * Tone markers by persona type, keyed by intensity level category.
 * 'high' = intensity >= 7, 'medium' = 4-6, 'low' = 1-3
 */
const TONE_MARKERS: Record<ConsumerPersonaType, Record<'high' | 'medium' | 'low', string[]>> = {
  angry: {
    high: ['!', 'sih', 'dong', 'kok bisa'],
    medium: ['sih', 'dong', 'ya'],
    low: ['ya', 'sih'],
  },
  critical: {
    high: ['kan', 'tuh', 'lho', 'masa'],
    medium: ['kan', 'sih', 'ya'],
    low: ['ya', 'kok'],
  },
  confused: {
    high: ['?', 'hah', 'gimana', 'maksudnya'],
    medium: ['ya?', 'gimana', 'kok'],
    low: ['ya', 'oh'],
  },
  rushed: {
    high: ['cepat', 'buruan', 'langsung aja'],
    medium: ['ayo', 'langsung', 'cepat'],
    low: ['ya', 'oke'],
  },
  passive: {
    high: ['ya', 'iya', 'terserah'],
    medium: ['ya', 'iya', 'oh'],
    low: ['ya', 'hmm'],
  },
  cooperative: {
    high: ['ya', 'oke', 'baik'],
    medium: ['ya', 'kok', 'oke'],
    low: ['ya', 'oke'],
  },
};

/**
 * Preferred filler words by persona type and intensity level.
 */
const PREFERRED_FILLERS: Record<ConsumerPersonaType, Record<'high' | 'medium' | 'low', string[]>> = {
  angry: {
    high: ['Heh', 'Woi', 'Aduh'],
    medium: ['Duh', 'Aduh', 'Yah'],
    low: ['Hmm', 'Yah'],
  },
  critical: {
    high: ['Nah', 'Tuh kan', 'Lihat'],
    medium: ['Nah', 'Hmm', 'Begini'],
    low: ['Hmm', 'Oh', 'Begitu'],
  },
  confused: {
    high: ['Hah', 'Lho', 'Eh'],
    medium: ['Eh', 'Hmm', 'Apa'],
    low: ['Hmm', 'Oh'],
  },
  rushed: {
    high: ['Ayo', 'Udah', 'Langsung'],
    medium: ['Oke', 'Yuk', 'Ayo'],
    low: ['Hmm', 'Oke'],
  },
  passive: {
    high: ['Iya', 'Ya', 'Oh'],
    medium: ['Hmm', 'Iya', 'Oh'],
    low: ['Hmm', 'Oh'],
  },
  cooperative: {
    high: ['Baik', 'Oke', 'Siap'],
    medium: ['Hmm', 'Oh', 'Iya'],
    low: ['Hmm', 'Oh'],
  },
};

/**
 * Response length preference by persona type and intensity level.
 */
const RESPONSE_LENGTHS: Record<
  ConsumerPersonaType,
  Record<'high' | 'medium' | 'low', 'short' | 'medium' | 'long'>
> = {
  angry: { high: 'short', medium: 'short', low: 'medium' },
  critical: { high: 'long', medium: 'medium', low: 'medium' },
  confused: { high: 'long', medium: 'medium', low: 'short' },
  rushed: { high: 'short', medium: 'short', low: 'medium' },
  passive: { high: 'short', medium: 'short', low: 'short' },
  cooperative: { high: 'medium', medium: 'medium', low: 'medium' },
};

/**
 * Interruption likelihood by persona type and intensity level.
 */
const INTERRUPTION_LIKELIHOOD: Record<ConsumerPersonaType, Record<'high' | 'medium' | 'low', number>> = {
  angry: { high: 0.7, medium: 0.4, low: 0.2 },
  critical: { high: 0.5, medium: 0.3, low: 0.1 },
  confused: { high: 0.3, medium: 0.2, low: 0.1 },
  rushed: { high: 0.6, medium: 0.4, low: 0.2 },
  passive: { high: 0.1, medium: 0.05, low: 0.0 },
  cooperative: { high: 0.2, medium: 0.1, low: 0.05 },
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Determines the intensity level category from a numeric intensity value.
 */
function getIntensityLevel(intensity: number): 'high' | 'medium' | 'low' {
  if (intensity >= 7) return 'high';
  if (intensity >= 4) return 'medium';
  return 'low';
}

/**
 * Clamps a value between min and max (inclusive).
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Computes the escalation delta based on persona type.
 * - angry/critical: 2-3 (uses midpoint 2)
 * - passive/cooperative: 1-2 (uses midpoint 1)
 * - confused/rushed: 1-2 (uses midpoint 1)
 *
 * Returns a deterministic value (lower bound of range) for predictability.
 */
function getEscalationDelta(personaType: ConsumerPersonaType): number {
  switch (personaType) {
    case 'angry':
    case 'critical':
      return 2;
    case 'passive':
    case 'cooperative':
      return 1;
    case 'confused':
    case 'rushed':
      return 1;
  }
}

/**
 * Computes the de-escalation delta.
 * De-escalation always reduces intensity by 1-2 (delta in [-2, -1]).
 * Returns -1 as the deterministic lower-magnitude change.
 */
function getDeEscalationDelta(): number {
  return -1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the initial intensity range for a given persona type.
 * Exported for testing and configuration display.
 */
export function getInitialIntensityRange(
  personaType: ConsumerPersonaType
): { min: number; max: number } {
  return INTENSITY_RANGES[personaType];
}

/**
 * Initializes a new PersonaState for the given persona type.
 * Sets emotional intensity to the midpoint of the persona's defined range.
 * If the range spans an even number, rounds down (uses Math.floor of midpoint).
 */
export function initializePersona(personaType: ConsumerPersonaType): PersonaState {
  const range = INTENSITY_RANGES[personaType];
  // Use the midpoint of the range (floor for integer result)
  const intensity = Math.floor((range.min + range.max) / 2);

  return {
    personaType,
    emotionalIntensity: intensity,
    exchangeCount: 0,
    lastDeEscalationAt: null,
    lastEscalationAt: null,
  };
}

/**
 * Reduces the persona state given an event, producing a new state,
 * the intensity delta, and updated language patterns.
 *
 * Invariants:
 * - personaType is NEVER changed (immutable)
 * - emotionalIntensity is always clamped to [1, 10]
 * - De-escalation delta is in [-2, 0]
 * - Escalation delta depends on persona type
 */
export function reducePersonaState(
  state: PersonaState,
  event: PersonaEvent
): PersonaResult {
  // Start with the current state; persona type is always preserved
  let newIntensity = state.emotionalIntensity;
  let intensityDelta = 0;
  let newExchangeCount = state.exchangeCount;
  let newLastDeEscalationAt = state.lastDeEscalationAt;
  let newLastEscalationAt = state.lastEscalationAt;

  switch (event.type) {
    case 'de_escalation': {
      intensityDelta = getDeEscalationDelta();
      newIntensity = clamp(state.emotionalIntensity + intensityDelta, MIN_INTENSITY, MAX_INTENSITY);
      newLastDeEscalationAt = newExchangeCount;
      break;
    }

    case 'escalation': {
      intensityDelta = getEscalationDelta(state.personaType);
      newIntensity = clamp(state.emotionalIntensity + intensityDelta, MIN_INTENSITY, MAX_INTENSITY);
      newLastEscalationAt = newExchangeCount;
      break;
    }

    case 'exchange_complete': {
      // Increment exchange count, no intensity change
      newExchangeCount = state.exchangeCount + 1;
      intensityDelta = 0;
      break;
    }

    case 'resolution_offered': {
      if (event.addressesConcern) {
        // Same as de-escalation
        intensityDelta = getDeEscalationDelta();
        newIntensity = clamp(state.emotionalIntensity + intensityDelta, MIN_INTENSITY, MAX_INTENSITY);
        newLastDeEscalationAt = newExchangeCount;
      } else {
        // Resolution offered but doesn't address concern: no change
        intensityDelta = 0;
      }
      break;
    }
  }

  const newState: PersonaState = {
    personaType: state.personaType, // IMMUTABLE
    emotionalIntensity: newIntensity,
    exchangeCount: newExchangeCount,
    lastDeEscalationAt: newLastDeEscalationAt,
    lastEscalationAt: newLastEscalationAt,
  };

  return {
    state: newState,
    intensityDelta,
    languagePatterns: generateLanguagePatterns(state.personaType, newIntensity),
  };
}

/**
 * Generates PersonaLanguagePatterns based on persona type and current intensity.
 * Used internally by reducePersonaState and can be called directly for
 * initial pattern generation.
 */
export function generateLanguagePatterns(
  personaType: ConsumerPersonaType,
  intensity: number
): PersonaLanguagePatterns {
  const level = getIntensityLevel(intensity);

  return {
    toneMarkers: TONE_MARKERS[personaType][level],
    preferredFillers: PREFERRED_FILLERS[personaType][level],
    responseLength: RESPONSE_LENGTHS[personaType][level],
    interruptionLikelihood: INTERRUPTION_LIKELIHOOD[personaType][level],
  };
}
