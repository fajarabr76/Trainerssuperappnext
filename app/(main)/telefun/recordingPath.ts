export type RecordingType = 'full_call' | 'agent_only';

export function isValidRecordingPath(
  path: string,
  userId: string,
  sessionId: string,
  type: RecordingType,
): boolean {
  return path === `${userId}/${sessionId}/${type}.webm`;
}

export function getOwnedRecordingPathOrNull(
  path: unknown,
  userId: string,
  sessionId: string,
  type: RecordingType,
): string | null {
  if (typeof path !== 'string') {
    return null;
  }

  return isValidRecordingPath(path, userId, sessionId, type) ? path : null;
}
