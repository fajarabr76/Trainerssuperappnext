import { describe, expect, it } from 'vitest';
import { reduceSessionState } from '../../app/(main)/telefun/services/sessionStateMachine';

describe('Telefun session state machine', () => {
  it('follows normal connect -> user -> ai flow', () => {
    let state = reduceSessionState('idle', 'connect_start');
    state = reduceSessionState(state, 'setup_complete');
    state = reduceSessionState(state, 'user_audio_valid');
    state = reduceSessionState(state, 'user_turn_end');
    state = reduceSessionState(state, 'model_first_audio');
    state = reduceSessionState(state, 'model_turn_complete');

    expect(state).toBe('ready');
  });

  it('moves through interruption candidate into user speaking', () => {
    let state = reduceSessionState('ai_speaking', 'interruption_candidate_valid');
    state = reduceSessionState(state, 'user_audio_valid');

    expect(state).toBe('user_speaking');
  });

  it('handles stalled and hard close transitions', () => {
    let state = reduceSessionState('ai_thinking', 'stalled');
    expect(state).toBe('recovering');
    state = reduceSessionState(state, 'close');
    expect(state).toBe('ended');
  });

  it('allows recovering state to continue when model audio arrives', () => {
    const state = reduceSessionState('recovering', 'model_first_audio');
    expect(state).toBe('ai_speaking');
  });
});
