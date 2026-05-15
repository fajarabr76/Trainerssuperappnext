/**
 * Turn-Taking Engine — Pure function guard for contextual end-of-turn detection.
 *
 * Replaces simple silence-based turn detection with contextual completeness
 * analysis using Indonesian language signals (sentence-final particles,
 * conjunctions, intonation patterns).
 *
 * Follows the pure function guard pattern from `interruptionGuards.ts`:
 * takes state + input, returns new state + action. No side effects.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import type { TelefunSessionState } from '../../types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ContextualSignals {
  hasFallingIntonation: boolean;
  hasSentenceFinalParticle: boolean; // "ya", "kan", "lho", "sih"
  hasConjunction: boolean; // "dan", "tapi", "karena", "jadi", "atau"
  hasRisingIntonation: boolean;
  lastTranscriptionChunk: string;
}

export interface TurnTakingState {
  silenceStartMs: number | null;
  lastAudioRms: number;
  isMultiClause: boolean;
  contextualSignals: ContextualSignals;
  pendingEndOfTurn: boolean;
  responseDelayUntil: number | null;
}

export interface TurnTakingInput {
  now: number;
  isSilent: boolean;
  rms: number;
  transcriptionChunk?: string;
  pitchHz?: number;
  sessionState: TelefunSessionState;
}

export type TurnTakingAction =
  | 'none'
  | 'end_of_turn'
  | 'extend_threshold'
  | 'suppress_non_speech';

export interface TurnTakingResult {
  state: TurnTakingState;
  action: TurnTakingAction;
  silenceThresholdMs: number; // 1500 default, 2000 for multi-clause
  confidence: number; // 0-1
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default silence threshold before end-of-turn (ms) */
const DEFAULT_SILENCE_THRESHOLD_MS = 1500;

/** Extended silence threshold for multi-clause or ambiguous signals (ms) */
const EXTENDED_SILENCE_THRESHOLD_MS = 2000;

/** Response delay applied after end-of-turn detection (ms) */
const RESPONSE_DELAY_MS = 400;

/** Maximum duration for non-speech sound suppression (ms) */
const NON_SPEECH_MAX_DURATION_MS = 300;

/** RMS threshold below which audio is considered non-speech noise */
const SPEECH_RMS_THRESHOLD = 0.02;

/** Indonesian sentence-final particles indicating turn completion */
const SENTENCE_FINAL_PARTICLES = ['ya', 'kan', 'lho', 'sih'];

/** Indonesian conjunctions indicating multi-clause continuation */
const CONJUNCTIONS = ['dan', 'tapi', 'karena', 'jadi', 'atau'];

/**
 * Approximate pitch threshold for falling intonation detection (Hz).
 * Below this value at end of utterance suggests declarative/complete.
 */
const FALLING_INTONATION_THRESHOLD_HZ = 150;

/**
 * Approximate pitch threshold for rising intonation detection (Hz).
 * Above this value at end of utterance suggests continuation/question.
 */
const RISING_INTONATION_THRESHOLD_HZ = 250;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Creates the initial (empty) turn-taking state.
 */
export function createInitialTurnTakingState(): TurnTakingState {
  return {
    silenceStartMs: null,
    lastAudioRms: 0,
    isMultiClause: false,
    contextualSignals: {
      hasFallingIntonation: false,
      hasSentenceFinalParticle: false,
      hasConjunction: false,
      hasRisingIntonation: false,
      lastTranscriptionChunk: '',
    },
    pendingEndOfTurn: false,
    responseDelayUntil: null,
  };
}

/**
 * Detects sentence-final particles in a transcription chunk.
 * Checks if the chunk ends with one of the Indonesian particles.
 */
function detectSentenceFinalParticle(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!?,;:]+$/, '');
  const words = normalized.split(/\s+/);
  const lastWord = words[words.length - 1] ?? '';
  return SENTENCE_FINAL_PARTICLES.includes(lastWord);
}

/**
 * Detects conjunctions in a transcription chunk that indicate
 * multi-clause continuation.
 */
function detectConjunction(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!?,;:]+$/, '');
  const words = normalized.split(/\s+/);
  const lastWord = words[words.length - 1] ?? '';
  return CONJUNCTIONS.includes(lastWord);
}

/**
 * Analyzes pitch to determine intonation pattern.
 */
function analyzeIntonation(pitchHz: number | undefined): {
  falling: boolean;
  rising: boolean;
} {
  if (pitchHz === undefined) {
    return { falling: false, rising: false };
  }
  return {
    falling: pitchHz <= FALLING_INTONATION_THRESHOLD_HZ,
    rising: pitchHz >= RISING_INTONATION_THRESHOLD_HZ,
  };
}

/**
 * Determines whether signals are ambiguous (neither clear completion
 * nor clear continuation).
 */
function hasAmbiguousSignals(signals: ContextualSignals): boolean {
  const hasCompletionSignal =
    signals.hasFallingIntonation || signals.hasSentenceFinalParticle;
  const hasContinuationSignal =
    signals.hasConjunction || signals.hasRisingIntonation;

  // Ambiguous: no clear signal in either direction
  return !hasCompletionSignal && !hasContinuationSignal;
}

/**
 * Determines whether there is a completeness signal indicating
 * the speaker has finished their turn.
 */
function hasCompletenessSignal(signals: ContextualSignals): boolean {
  return signals.hasFallingIntonation || signals.hasSentenceFinalParticle;
}

// ---------------------------------------------------------------------------
// Main Pure Function Guard
// ---------------------------------------------------------------------------

/**
 * Evaluates turn-taking state given current audio/transcription input.
 *
 * Logic flow:
 * 1. If audio event < 300ms and RMS below speech threshold → suppress_non_speech
 * 2. If silence detected, start tracking silence duration
 * 3. Analyze transcription for contextual signals (particles, conjunctions, intonation)
 * 4. If multi-clause detected (conjunction or rising intonation) → threshold = 2000ms
 * 5. If silence >= threshold AND has completeness signal → end_of_turn
 * 6. If ambiguous signals → threshold = 2000ms
 * 7. On end_of_turn → set responseDelayUntil = now + 400
 */
export function evaluateTurnTaking(
  state: TurnTakingState,
  input: TurnTakingInput
): TurnTakingResult {
  const nextState: TurnTakingState = { ...state };
  const intonation = analyzeIntonation(input.pitchHz);

  // Update contextual signals from transcription chunk
  if (input.transcriptionChunk) {
    const chunk = input.transcriptionChunk;
    nextState.contextualSignals = {
      ...nextState.contextualSignals,
      hasSentenceFinalParticle: detectSentenceFinalParticle(chunk),
      hasConjunction: detectConjunction(chunk),
      hasFallingIntonation: intonation.falling,
      hasRisingIntonation: intonation.rising,
      lastTranscriptionChunk: chunk,
    };
  } else {
    // Update intonation even without transcription
    nextState.contextualSignals = {
      ...nextState.contextualSignals,
      hasFallingIntonation: intonation.falling,
      hasRisingIntonation: intonation.rising,
    };
  }

  // Update multi-clause detection
  nextState.isMultiClause =
    nextState.contextualSignals.hasConjunction ||
    nextState.contextualSignals.hasRisingIntonation;

  // Store last RMS
  nextState.lastAudioRms = input.rms;

  // --- Rule 1: Suppress non-speech sounds < 300ms with low RMS ---
  // If we're not in silence and the RMS is below speech threshold,
  // this is a non-speech sound. Check duration.
  if (!input.isSilent && input.rms < SPEECH_RMS_THRESHOLD) {
    // If silence was previously tracked and the non-speech event is brief
    if (
      state.silenceStartMs !== null &&
      input.now - state.silenceStartMs < NON_SPEECH_MAX_DURATION_MS
    ) {
      // Brief non-speech sound during silence tracking — suppress
      return {
        state: nextState,
        action: 'suppress_non_speech',
        silenceThresholdMs: nextState.isMultiClause
          ? EXTENDED_SILENCE_THRESHOLD_MS
          : DEFAULT_SILENCE_THRESHOLD_MS,
        confidence: 0.9,
      };
    }

    // Non-speech sound without prior silence — still suppress if brief
    // We track this as a potential non-speech event
    if (state.silenceStartMs === null) {
      // Start tracking to measure duration
      nextState.silenceStartMs = input.now;
      return {
        state: nextState,
        action: 'suppress_non_speech',
        silenceThresholdMs: nextState.isMultiClause
          ? EXTENDED_SILENCE_THRESHOLD_MS
          : DEFAULT_SILENCE_THRESHOLD_MS,
        confidence: 0.8,
      };
    }
  }

  // --- Rule 2: Track silence duration ---
  if (input.isSilent) {
    if (nextState.silenceStartMs === null) {
      nextState.silenceStartMs = input.now;
    }
  } else {
    // Agent is speaking — reset silence tracking and signals for next pause
    nextState.silenceStartMs = null;
    nextState.pendingEndOfTurn = false;

    const threshold = nextState.isMultiClause
      ? EXTENDED_SILENCE_THRESHOLD_MS
      : DEFAULT_SILENCE_THRESHOLD_MS;

    return {
      state: nextState,
      action: 'none',
      silenceThresholdMs: threshold,
      confidence: 0,
    };
  }

  // --- From here, we know input.isSilent === true ---
  const silenceDurationMs = input.now - (nextState.silenceStartMs ?? input.now);

  // --- Rule 4 & 5: Determine silence threshold ---
  let silenceThresholdMs: number;

  if (nextState.isMultiClause) {
    // Multi-clause: extend threshold to 2000ms (Req 2.5)
    silenceThresholdMs = EXTENDED_SILENCE_THRESHOLD_MS;
  } else if (hasAmbiguousSignals(nextState.contextualSignals)) {
    // Ambiguous signals: extend threshold to 2000ms (Req 2.7)
    silenceThresholdMs = EXTENDED_SILENCE_THRESHOLD_MS;
  } else {
    // Default: 1500ms with completeness signal required (Req 2.6)
    silenceThresholdMs = DEFAULT_SILENCE_THRESHOLD_MS;
  }

  // --- Rule 3: Check if silence exceeds threshold ---
  if (silenceDurationMs >= silenceThresholdMs) {
    // For default threshold, require at least one completeness signal (Req 2.6)
    if (
      silenceThresholdMs === DEFAULT_SILENCE_THRESHOLD_MS &&
      !hasCompletenessSignal(nextState.contextualSignals)
    ) {
      // No completeness signal with default threshold — extend to 2000ms
      silenceThresholdMs = EXTENDED_SILENCE_THRESHOLD_MS;

      if (silenceDurationMs < silenceThresholdMs) {
        return {
          state: nextState,
          action: 'extend_threshold',
          silenceThresholdMs,
          confidence: 0.4,
        };
      }
    }

    // End-of-turn detected
    const confidence = hasCompletenessSignal(nextState.contextualSignals)
      ? 0.9
      : 0.6;

    // Apply 400ms response delay (Req 2.4)
    nextState.pendingEndOfTurn = true;
    nextState.responseDelayUntil = input.now + RESPONSE_DELAY_MS;

    return {
      state: nextState,
      action: 'end_of_turn',
      silenceThresholdMs,
      confidence,
    };
  }

  // --- Silence is building but hasn't reached threshold yet ---
  // If multi-clause or ambiguous, signal threshold extension
  if (
    nextState.isMultiClause &&
    silenceThresholdMs === EXTENDED_SILENCE_THRESHOLD_MS
  ) {
    return {
      state: nextState,
      action: 'extend_threshold',
      silenceThresholdMs,
      confidence: 0.3,
    };
  }

  return {
    state: nextState,
    action: 'none',
    silenceThresholdMs,
    confidence: 0,
  };
}
