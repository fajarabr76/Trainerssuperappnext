import type { TelefunSessionState } from '../types';

export interface StalledResponseState {
  waitingForModelSince: number | null;
  lastModelEventAt: number | null;
  recoveryLevel: 0 | 1 | 2 | 3;
}

export interface StalledResponseInput {
  now: number;
  sessionState: TelefunSessionState;
  responseStartTimeoutMs?: number;
  midResponseTimeoutMs?: number;
}

export type StalledResponseAction = 'none' | 'mark_recovering' | 'soft_nudge' | 'terminate';

export interface StalledResponseResult {
  state: StalledResponseState;
  isStalled: boolean;
  action: StalledResponseAction;
  timeoutType: 'none' | 'response_start' | 'mid_response';
}

const DEFAULT_RESPONSE_START_TIMEOUT_MS = 5000;
const DEFAULT_MID_RESPONSE_TIMEOUT_MS = 7000;

export function markWaitingForModel(state: StalledResponseState, now: number): StalledResponseState {
  return {
    ...state,
    waitingForModelSince: now,
    recoveryLevel: 0,
  };
}

export function markModelActivity(state: StalledResponseState, now: number): StalledResponseState {
  return {
    ...state,
    waitingForModelSince: null,
    lastModelEventAt: now,
    recoveryLevel: 0,
  };
}

export function evaluateStalledResponse(
  state: StalledResponseState,
  input: StalledResponseInput
): StalledResponseResult {
  const responseStartTimeoutMs = input.responseStartTimeoutMs ?? DEFAULT_RESPONSE_START_TIMEOUT_MS;
  const midResponseTimeoutMs = input.midResponseTimeoutMs ?? DEFAULT_MID_RESPONSE_TIMEOUT_MS;

  let isStalled = false;
  let action: StalledResponseAction = 'none';
  let timeoutType: StalledResponseResult['timeoutType'] = 'none';
  const nextState = { ...state };

  if (input.sessionState === 'ai_thinking' && state.waitingForModelSince !== null) {
    const elapsed = input.now - state.waitingForModelSince;
    if (elapsed >= responseStartTimeoutMs) {
      isStalled = true;
      timeoutType = 'response_start';
      if (state.recoveryLevel === 0) {
        action = 'mark_recovering';
        nextState.recoveryLevel = 1;
      } else if (state.recoveryLevel === 1) {
        action = 'soft_nudge';
        nextState.recoveryLevel = 2;
      } else if (state.recoveryLevel >= 2) {
        action = 'terminate';
        nextState.recoveryLevel = 3;
      }
    }
  }

  if (
    !isStalled &&
    input.sessionState === 'ai_speaking' &&
    state.lastModelEventAt !== null &&
    input.now - state.lastModelEventAt >= midResponseTimeoutMs
  ) {
    isStalled = true;
    timeoutType = 'mid_response';
    action = state.recoveryLevel >= 1 ? 'terminate' : 'mark_recovering';
    nextState.recoveryLevel = action === 'terminate' ? 3 : 1;
  }

  return {
    state: nextState,
    isStalled,
    action,
    timeoutType,
  };
}
