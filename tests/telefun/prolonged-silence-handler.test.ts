import { describe, expect, it } from 'vitest';
import {
  createInitialSilenceState,
  evaluateProlongedSilence,
  type ProlongedSilenceState,
} from '../../app/(main)/telefun/services/realisticMode/prolongedSilenceHandler';

const baseState: ProlongedSilenceState = {
  deadAirStartMs: null,
  escalationLevel: 'none',
  uiHoldActive: false,
  uiHoldDetectedAt: null,
  uiTimerDurationMs: null,
  lastAgentAudioAt: null,
};

describe('Prolonged Silence Handler', () => {
  it('creates initial state with all fields null/none', () => {
    const state = createInitialSilenceState();
    expect(state.deadAirStartMs).toBeNull();
    expect(state.escalationLevel).toBe('none');
    expect(state.uiHoldActive).toBe(false);
    expect(state.uiHoldDetectedAt).toBeNull();
    expect(state.uiTimerDurationMs).toBeNull();
    expect(state.lastAgentAudioAt).toBeNull();
  });

  it('starts dead air tracking when agent is not speaking', () => {
    const result = evaluateProlongedSilence(baseState, {
      now: 1000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.state.deadAirStartMs).toBe(1000);
    expect(result.action).toBe('none');
  });

  it('triggers check_in after 8s of dead air (normal)', () => {
    const silenceStart: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
    };
    const result = evaluateProlongedSilence(silenceStart, {
      now: 8000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('check_in');
    expect(result.state.escalationLevel).toBe('check_in');
    expect(result.thresholds.checkInMs).toBe(8000);
  });

  it('triggers closing_prompt after 20s of dead air (normal)', () => {
    const afterCheckIn: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
      escalationLevel: 'check_in',
    };
    const result = evaluateProlongedSilence(afterCheckIn, {
      now: 20000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('closing_prompt');
    expect(result.state.escalationLevel).toBe('closing_prompt');
  });

  it('triggers end_session after 35s of dead air (normal)', () => {
    const afterClosing: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
      escalationLevel: 'closing_prompt',
    };
    const result = evaluateProlongedSilence(afterClosing, {
      now: 35000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('end_session');
    expect(result.state.escalationLevel).toBe('session_end');
  });

  it('does not escalate before threshold is reached', () => {
    const silenceStart: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
    };
    const result = evaluateProlongedSilence(silenceStart, {
      now: 7999,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('none');
    expect(result.state.escalationLevel).toBe('none');
  });

  it('resets all timers when agent speaks > 300ms', () => {
    const escalated: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
      escalationLevel: 'check_in',
    };
    const result = evaluateProlongedSilence(escalated, {
      now: 10000,
      agentSpeaking: true,
      agentAudioDurationMs: 400,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('reset_timers');
    expect(result.state.deadAirStartMs).toBeNull();
    expect(result.state.escalationLevel).toBe('none');
    expect(result.state.lastAgentAudioAt).toBe(10000);
  });

  it('does not reset timers when agent speaks <= 300ms', () => {
    const silenceStart: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
      escalationLevel: 'check_in',
    };
    const result = evaluateProlongedSilence(silenceStart, {
      now: 5000,
      agentSpeaking: true,
      agentAudioDurationMs: 200,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('none');
    expect(result.state.escalationLevel).toBe('check_in');
  });

  it('returns normal thresholds when hold is not active', () => {
    const result = evaluateProlongedSilence(baseState, {
      now: 1000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.thresholds.checkInMs).toBe(8000);
    expect(result.thresholds.closingPromptMs).toBe(20000);
    expect(result.thresholds.sessionEndMs).toBe(35000);
  });

  it('activates UI hold when uiHoldActive=true', () => {
    const result = evaluateProlongedSilence(baseState, {
      now: 1000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: true,
      uiHoldTimerExpired: false,
      uiTimerDurationMs: 60000,
    });
    expect(result.action).toBe('activate_hold_ui');
    expect(result.state.uiHoldActive).toBe(true);
    expect(result.state.uiTimerDurationMs).toBe(60000);
    expect(result.thresholds.checkInMs).toBe(Infinity);
    expect(result.thresholds.closingPromptMs).toBe(Infinity);
    expect(result.thresholds.sessionEndMs).toBe(60000);
  });

  it('deactivates hold when uiHoldTimerExpired=true during UI hold', () => {
    const uiHoldState: ProlongedSilenceState = {
      ...baseState,
      uiHoldActive: true,
      uiHoldDetectedAt: 1000,
      uiTimerDurationMs: 60000,
      deadAirStartMs: 1000,
    };
    const result = evaluateProlongedSilence(uiHoldState, {
      now: 61000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: true,
      uiHoldTimerExpired: true,
    });
    expect(result.action).toBe('deactivate_hold');
    expect(result.state.uiHoldActive).toBe(false);
    expect(result.state.deadAirStartMs).toBeNull();
    expect(result.state.escalationLevel).toBe('none');
  });

  it('deactivates hold when uiHoldActive becomes false during UI hold', () => {
    const uiHoldState: ProlongedSilenceState = {
      ...baseState,
      uiHoldActive: true,
      uiHoldDetectedAt: 1000,
      uiTimerDurationMs: 60000,
      deadAirStartMs: 1000,
    };
    const result = evaluateProlongedSilence(uiHoldState, {
      now: 30000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('deactivate_hold');
    expect(result.state.uiHoldActive).toBe(false);
  });

  it('UI hold suppresses check_in and closing_prompt entirely', () => {
    const uiHoldState: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
      uiHoldActive: true,
      uiHoldDetectedAt: 0,
      uiTimerDurationMs: 60000,
    };
    const result = evaluateProlongedSilence(uiHoldState, {
      now: 30000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: true,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('none');

    const result45 = evaluateProlongedSilence(uiHoldState, {
      now: 45000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: true,
      uiHoldTimerExpired: false,
    });
    expect(result45.action).toBe('none');

    const result60 = evaluateProlongedSilence(uiHoldState, {
      now: 60000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: true,
      uiHoldTimerExpired: false,
    });
    expect(result60.action).toBe('end_session');
  });

  it('cancels escalation when agent resumes speaking > 300ms', () => {
    const escalated: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 0,
      escalationLevel: 'closing_prompt',
    };
    const result = evaluateProlongedSilence(escalated, {
      now: 25000,
      agentSpeaking: true,
      agentAudioDurationMs: 500,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.action).toBe('reset_timers');
    expect(result.state.escalationLevel).toBe('none');
    expect(result.state.deadAirStartMs).toBeNull();
  });

  it('escalation is cumulative from deadAirStartMs', () => {
    const state: ProlongedSilenceState = {
      ...baseState,
      deadAirStartMs: 1000,
    };
    const checkIn = evaluateProlongedSilence(state, {
      now: 9000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(checkIn.action).toBe('check_in');

    const closing = evaluateProlongedSilence(checkIn.state, {
      now: 21000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(closing.action).toBe('closing_prompt');

    const end = evaluateProlongedSilence(closing.state, {
      now: 36000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(end.action).toBe('end_session');
  });

  it('UI hold with 180000ms timer for subsequent holds', () => {
    const result = evaluateProlongedSilence(baseState, {
      now: 1000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: true,
      uiHoldTimerExpired: false,
      uiTimerDurationMs: 180000,
    });
    expect(result.action).toBe('activate_hold_ui');
    expect(result.state.uiHoldActive).toBe(true);
    expect(result.state.uiTimerDurationMs).toBe(180000);
    expect(result.thresholds.sessionEndMs).toBe(180000);
  });

  it('instruction phrases do not activate or affect hold (normal thresholds apply)', () => {
    const result = evaluateProlongedSilence(baseState, {
      now: 1000,
      agentSpeaking: false,
      agentAudioDurationMs: 0,
      sessionState: 'ai_thinking',
      uiHoldActive: false,
      uiHoldTimerExpired: false,
    });
    expect(result.thresholds.checkInMs).toBe(8000);
    expect(result.thresholds.closingPromptMs).toBe(20000);
    expect(result.thresholds.sessionEndMs).toBe(35000);
  });
});
