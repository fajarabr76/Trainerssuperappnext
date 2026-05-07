import { describe, expect, it } from 'vitest';
import {
  evaluateStalledResponse,
  markModelActivity,
  markWaitingForModel,
  type StalledResponseState,
} from '../../app/(main)/telefun/services/stalledResponseGuards';

const baseState: StalledResponseState = {
  waitingForModelSince: null,
  lastModelEventAt: null,
  recoveryLevel: 0,
};

describe('Telefun stalled response guard', () => {
  it('activates only when waiting in ai_thinking state', () => {
    const waiting = markWaitingForModel(baseState, 1000);
    const notThinking = evaluateStalledResponse(waiting, {
      now: 7000,
      sessionState: 'ready',
      responseStartTimeoutMs: 5000,
    });
    const thinking = evaluateStalledResponse(waiting, {
      now: 7000,
      sessionState: 'ai_thinking',
      responseStartTimeoutMs: 5000,
    });

    expect(notThinking.isStalled).toBe(false);
    expect(thinking.isStalled).toBe(true);
    expect(thinking.action).toBe('mark_recovering');
    expect(thinking.timeoutType).toBe('response_start');
  });

  it('escalates recovery level for stalled start response', () => {
    const waiting = markWaitingForModel(baseState, 1000);
    const level1 = evaluateStalledResponse(waiting, {
      now: 7000,
      sessionState: 'ai_thinking',
      responseStartTimeoutMs: 5000,
    });
    const level2 = evaluateStalledResponse(level1.state, {
      now: 8000,
      sessionState: 'ai_thinking',
      responseStartTimeoutMs: 5000,
    });
    const level3 = evaluateStalledResponse(level2.state, {
      now: 9000,
      sessionState: 'ai_thinking',
      responseStartTimeoutMs: 5000,
    });

    expect(level1.action).toBe('mark_recovering');
    expect(level2.action).toBe('soft_nudge');
    expect(level3.action).toBe('terminate');
    expect(level3.timeoutType).toBe('response_start');
  });

  it('resets waiting when model activity is seen', () => {
    const waiting = markWaitingForModel(baseState, 1000);
    const active = markModelActivity(waiting, 3000);
    expect(active.waitingForModelSince).toBeNull();
    expect(active.lastModelEventAt).toBe(3000);
    expect(active.recoveryLevel).toBe(0);
  });

  it('classifies mid-response timeout separately', () => {
    const midResponse = evaluateStalledResponse(
      { waitingForModelSince: null, lastModelEventAt: 1000, recoveryLevel: 0 },
      { now: 9000, sessionState: 'ai_speaking', midResponseTimeoutMs: 7000 }
    );
    expect(midResponse.isStalled).toBe(true);
    expect(midResponse.timeoutType).toBe('mid_response');
  });
});
