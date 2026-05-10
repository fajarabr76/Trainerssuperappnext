import { describe, expect, it } from 'vitest';
import {
  getPersistableRecordingUrl,
  getServerRecordRecordingUrl,
  shouldRevokeOptimisticRecordingUrl,
} from '@/app/(main)/telefun/recordingUrl';

describe('Telefun recording URL lifecycle', () => {
  it('does not persist browser blob URLs to server rows', () => {
    expect(getPersistableRecordingUrl('blob:https://app.example/recording')).toBe('');
    expect(getPersistableRecordingUrl('https://storage.example/recording.webm')).toBe('https://storage.example/recording.webm');
    expect(getPersistableRecordingUrl(null)).toBe('');
  });

  it('uses signed-url fetch path after full recording is stored', () => {
    const serverUrl = getServerRecordRecordingUrl({
      recordingPath: 'user-1/session-1/full_call.webm',
      persistedRecordingUrl: 'blob:https://app.example/stale',
      localRecordingUrl: 'blob:https://app.example/current',
    });

    expect(serverUrl).toBe('');
    expect(shouldRevokeOptimisticRecordingUrl('blob:https://app.example/current', serverUrl)).toBe(true);
  });

  it('keeps local blob URL when full recording storage path is unavailable', () => {
    const serverUrl = getServerRecordRecordingUrl({
      recordingPath: undefined,
      persistedRecordingUrl: '',
      localRecordingUrl: 'blob:https://app.example/current',
    });

    expect(serverUrl).toBe('blob:https://app.example/current');
    expect(shouldRevokeOptimisticRecordingUrl('blob:https://app.example/current', serverUrl)).toBe(false);
  });
});
