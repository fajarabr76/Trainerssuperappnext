/**
 * Prolonged Silence Handler — Pure Function Guard
 *
 * Manages dead air escalation with UI hold button integration. Instruction
 * phrases do not affect thresholds or activate hold — they are recorded as
 * consent requests by the orchestrator.
 *
 * Escalation sequence (no hold):
 *   check_in (8s) → closing_prompt (20s) → end_session (35s)
 *
 * Escalation sequence (UI hold):
 *   check_in and closing_prompt suppressed entirely
 *   end_session at uiTimerDurationMs (60000 first hold, 180000 subsequent)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */

import type { TelefunSessionState } from './types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ProlongedSilenceState {
  deadAirStartMs: number | null;
  escalationLevel: 'none' | 'check_in' | 'closing_prompt' | 'session_end';
  uiHoldActive: boolean;
  uiHoldDetectedAt: number | null;
  uiTimerDurationMs: number | null; // 60000 for first hold, 180000 for subsequent
  lastAgentAudioAt: number | null;
}

export interface ProlongedSilenceInput {
  now: number;
  agentSpeaking: boolean;
  agentAudioDurationMs: number;
  sessionState: TelefunSessionState;
  uiHoldActive: boolean;
  uiHoldTimerExpired: boolean;
  uiTimerDurationMs?: number; // from UI hold button timer
}

export interface ProlongedSilenceThresholds {
  checkInMs: number;        // 8000 normal, suppressed for ui-hold
  closingPromptMs: number;  // 20000 normal, suppressed for ui-hold
  sessionEndMs: number;     // 35000 normal, uiTimerDurationMs for ui-hold
}

export type ProlongedSilenceAction =
  | 'none'
  | 'check_in'
  | 'closing_prompt'
  | 'end_session'
  | 'reset_timers'
  | 'activate_hold_ui'
  | 'deactivate_hold';

export interface ProlongedSilenceResult {
  state: ProlongedSilenceState;
  action: ProlongedSilenceAction;
  thresholds: ProlongedSilenceThresholds;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NORMAL_THRESHOLDS: ProlongedSilenceThresholds = {
  checkInMs: 8000,
  closingPromptMs: 20000,
  sessionEndMs: 35000,
};

/** Minimum agent audio duration (ms) to trigger a timer reset. */
const AGENT_SPEECH_RESET_THRESHOLD_MS = 300;

/** Default UI timer duration (ms) when none is provided. */
const DEFAULT_UI_TIMER_MS = 60000;

// ---------------------------------------------------------------------------
// Initial State Factory
// ---------------------------------------------------------------------------

export function createInitialSilenceState(): ProlongedSilenceState {
  return {
    deadAirStartMs: null,
    escalationLevel: 'none',
    uiHoldActive: false,
    uiHoldDetectedAt: null,
    uiTimerDurationMs: null,
    lastAgentAudioAt: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the active thresholds based on UI hold state.
 * UI-initiated hold suppresses check-in and closing-prompt by setting them
 * to Infinity, and uses uiTimerDurationMs as the session-end threshold.
 */
function getThresholds(
  uiHoldActive: boolean,
  uiTimerDurationMs: number | null
): ProlongedSilenceThresholds {
  if (uiHoldActive) {
    return {
      checkInMs: Infinity,       // suppressed
      closingPromptMs: Infinity, // suppressed
      sessionEndMs: uiTimerDurationMs ?? DEFAULT_UI_TIMER_MS,
    };
  }
  return NORMAL_THRESHOLDS;
}

// ---------------------------------------------------------------------------
// Pure Function Guard
// ---------------------------------------------------------------------------

/**
 * Evaluates the current prolonged silence state and determines the next
 * action to take. This is a pure function — no side effects.
 *
 * The function handles two modes:
 * - uiHoldActive=false: Normal escalation at 8s/20s/35s
 * - uiHoldActive=true: Only session-end at uiTimerDurationMs,
 *   check-in and closing suppressed
 */
export function evaluateProlongedSilence(
  state: ProlongedSilenceState,
  input: ProlongedSilenceInput
): ProlongedSilenceResult {
  // --- Agent speech reset (Requirement 3.5, 3.6) ---
  // When agent speaks > 300ms, reset all dead air state and cancel escalation
  if (input.agentSpeaking && input.agentAudioDurationMs > AGENT_SPEECH_RESET_THRESHOLD_MS) {
    const resetState: ProlongedSilenceState = {
      ...state,
      deadAirStartMs: null,
      escalationLevel: 'none',
      uiHoldActive: state.uiHoldActive, // preserve UI hold state
      uiHoldDetectedAt: null,
      uiTimerDurationMs: state.uiHoldActive ? state.uiTimerDurationMs : null,
      lastAgentAudioAt: input.now,
    };
    return {
      state: resetState,
      action: 'reset_timers',
      thresholds: NORMAL_THRESHOLDS,
    };
  }

  // --- UI Hold activation (Requirement 3.7) ---
  // When uiHoldActive=true and we're not already in UI hold, activate UI hold
  if (input.uiHoldActive && !state.uiHoldActive) {
    const uiTimerMs = input.uiTimerDurationMs ?? DEFAULT_UI_TIMER_MS;
    const newState: ProlongedSilenceState = {
      ...state,
      uiHoldActive: true,
      uiHoldDetectedAt: input.now,
      uiTimerDurationMs: uiTimerMs,
      escalationLevel: 'none',
      deadAirStartMs: input.now,
      lastAgentAudioAt: input.agentSpeaking ? input.now : state.lastAgentAudioAt,
    };
    return {
      state: newState,
      action: 'activate_hold_ui',
      thresholds: getThresholds(true, uiTimerMs),
    };
  }

  // --- UI Hold timer expired or hold released (Requirement 3.9) ---
  if (input.uiHoldTimerExpired && state.uiHoldActive) {
    const deactivatedState: ProlongedSilenceState = {
      ...state,
      uiHoldActive: false,
      uiHoldDetectedAt: null,
      uiTimerDurationMs: null,
      deadAirStartMs: null,
      escalationLevel: 'none',
      lastAgentAudioAt: input.agentSpeaking ? input.now : state.lastAgentAudioAt,
    };
    return {
      state: deactivatedState,
      action: 'deactivate_hold',
      thresholds: NORMAL_THRESHOLDS,
    };
  }

  // --- UI Hold released (uiHoldActive becomes false while in UI hold) ---
  if (!input.uiHoldActive && state.uiHoldActive) {
    const deactivatedState: ProlongedSilenceState = {
      ...state,
      uiHoldActive: false,
      uiHoldDetectedAt: null,
      uiTimerDurationMs: null,
      deadAirStartMs: null,
      escalationLevel: 'none',
      lastAgentAudioAt: input.agentSpeaking ? input.now : state.lastAgentAudioAt,
    };
    return {
      state: deactivatedState,
      action: 'deactivate_hold',
      thresholds: NORMAL_THRESHOLDS,
    };
  }

  // --- Track agent audio timestamp ---
  let nextState: ProlongedSilenceState = { ...state };
  if (input.agentSpeaking) {
    nextState = { ...nextState, lastAgentAudioAt: input.now };
  }

  // --- Start dead air tracking if not already started ---
  if (nextState.deadAirStartMs === null && !input.agentSpeaking) {
    nextState = { ...nextState, deadAirStartMs: input.now };
  }

  // If agent is currently speaking (but below reset threshold), no escalation
  if (input.agentSpeaking) {
    const thresholds = getThresholds(nextState.uiHoldActive, nextState.uiTimerDurationMs);
    return {
      state: nextState,
      action: 'none',
      thresholds,
    };
  }

  // --- Dead air escalation (Requirements 3.1, 3.2, 3.3, 3.7, 3.8) ---
  if (nextState.deadAirStartMs === null) {
    const thresholds = getThresholds(nextState.uiHoldActive, nextState.uiTimerDurationMs);
    return { state: nextState, action: 'none', thresholds };
  }

  const activeThresholds = getThresholds(nextState.uiHoldActive, nextState.uiTimerDurationMs);
  const deadAirDuration = input.now - nextState.deadAirStartMs;

  // Check escalation levels in order (highest first to avoid skipping)
  // For UI hold: only session_end is possible (check_in and closing_prompt are Infinity)
  if (
    deadAirDuration >= activeThresholds.sessionEndMs &&
    nextState.escalationLevel !== 'session_end'
  ) {
    return {
      state: { ...nextState, escalationLevel: 'session_end' },
      action: 'end_session',
      thresholds: activeThresholds,
    };
  }

  if (
    deadAirDuration >= activeThresholds.closingPromptMs &&
    nextState.escalationLevel !== 'closing_prompt' &&
    nextState.escalationLevel !== 'session_end'
  ) {
    return {
      state: { ...nextState, escalationLevel: 'closing_prompt' },
      action: 'closing_prompt',
      thresholds: activeThresholds,
    };
  }

  if (
    deadAirDuration >= activeThresholds.checkInMs &&
    nextState.escalationLevel === 'none'
  ) {
    return {
      state: { ...nextState, escalationLevel: 'check_in' },
      action: 'check_in',
      thresholds: activeThresholds,
    };
  }

  // No escalation threshold crossed yet
  return { state: nextState, action: 'none', thresholds: activeThresholds };
}
