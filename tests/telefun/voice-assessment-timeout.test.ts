import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWithVoiceAssessmentTimeout } from '@/app/actions/voiceAssessmentTimeout';

describe('voice assessment timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects when the model request does not settle before the timeout', async () => {
    vi.useFakeTimers();

    const request = runWithVoiceAssessmentTimeout(() => new Promise(() => {}), 1000);
    const assertion = expect(request).rejects.toThrow('Voice assessment request timed out');

    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
  });

  it('aborts the request signal when the timeout expires', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;

    const request = runWithVoiceAssessmentTimeout(signal => {
      requestSignal = signal;
      return new Promise(() => {});
    }, 1000);
    const assertion = expect(request).rejects.toThrow('Voice assessment request timed out');

    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);

    expect(requestSignal?.aborted).toBe(true);
    await assertion;
  });

  it('returns the model response when it settles before the timeout', async () => {
    vi.useFakeTimers();

    const request = runWithVoiceAssessmentTimeout(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 500)),
      1000,
    );

    await vi.advanceTimersByTimeAsync(500);

    await expect(request).resolves.toEqual({ success: true });
  });
});
