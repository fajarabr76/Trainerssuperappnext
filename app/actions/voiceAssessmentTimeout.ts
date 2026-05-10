export const VOICE_ASSESSMENT_REQUEST_TIMEOUT_MS = 45_000;

export async function runWithVoiceAssessmentTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = VOICE_ASSESSMENT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Voice assessment request timed out'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
