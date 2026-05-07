import type { TelefunSessionState } from '../types';

export type TelefunSessionEvent =
  | 'connect_start'
  | 'setup_complete'
  | 'user_audio_valid'
  | 'user_turn_end'
  | 'model_first_audio'
  | 'model_turn_complete'
  | 'interruption_candidate_valid'
  | 'stalled'
  | 'recover'
  | 'close';

const TRANSITIONS: Record<TelefunSessionState, Partial<Record<TelefunSessionEvent, TelefunSessionState>>> = {
  idle: {
    connect_start: 'connecting',
    close: 'ended',
  },
  connecting: {
    setup_complete: 'ready',
    stalled: 'recovering',
    close: 'ended',
  },
  ready: {
    user_audio_valid: 'user_speaking',
    stalled: 'recovering',
    close: 'ended',
  },
  user_speaking: {
    user_turn_end: 'ai_thinking',
    close: 'ended',
  },
  ai_thinking: {
    model_first_audio: 'ai_speaking',
    stalled: 'recovering',
    close: 'ended',
  },
  ai_speaking: {
    model_turn_complete: 'ready',
    interruption_candidate_valid: 'interruption_candidate',
    stalled: 'recovering',
    close: 'ended',
  },
  interruption_candidate: {
    user_audio_valid: 'user_speaking',
    close: 'ended',
  },
  recovering: {
    recover: 'ready',
    close: 'ended',
  },
  ended: {},
};

export function reduceSessionState(
  state: TelefunSessionState,
  event: TelefunSessionEvent
): TelefunSessionState {
  return TRANSITIONS[state][event] ?? state;
}
