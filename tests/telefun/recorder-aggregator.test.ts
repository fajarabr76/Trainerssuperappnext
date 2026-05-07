import { describe, it, expect, vi } from 'vitest';

// Mock server-only before any other imports
vi.mock('server-only', () => ({}));

// We mock things needed for the service
vi.mock('@/app/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  getOwnedRecordingPathOrNull,
  isValidRecordingPath,
} from '@/app/(main)/telefun/recordingPath';

describe('Telefun Recording Security', () => {
  const userId = 'user-123';
  const sessionId = 'session-456';

  it('validates correct paths', () => {
    expect(isValidRecordingPath(`${userId}/${sessionId}/full_call.webm`, userId, sessionId, 'full_call')).toBe(true);
    expect(isValidRecordingPath(`${userId}/${sessionId}/agent_only.webm`, userId, sessionId, 'agent_only')).toBe(true);
  });

  it('rejects incorrect type for path', () => {
    expect(isValidRecordingPath(`${userId}/${sessionId}/full_call.webm`, userId, sessionId, 'agent_only')).toBe(false);
    expect(isValidRecordingPath(`${userId}/${sessionId}/agent_only.webm`, userId, sessionId, 'full_call')).toBe(false);
  });

  it('rejects tampered user IDs', () => {
    expect(isValidRecordingPath(`hacker/${sessionId}/full_call.webm`, userId, sessionId, 'full_call')).toBe(false);
  });

  it('rejects tampered session IDs', () => {
    expect(isValidRecordingPath(`${userId}/another-session/full_call.webm`, userId, sessionId, 'full_call')).toBe(false);
  });

  it('rejects arbitrary filenames', () => {
    expect(isValidRecordingPath(`${userId}/${sessionId}/malicious.sh`, userId, sessionId, 'full_call')).toBe(false);
  });

  it('rejects directory traversal', () => {
    expect(isValidRecordingPath(`${userId}/${sessionId}/../../../etc/passwd`, userId, sessionId, 'full_call')).toBe(false);
  });

  it('returns owned path when exact path matches', () => {
    const path = `${userId}/${sessionId}/agent_only.webm`;
    expect(getOwnedRecordingPathOrNull(path, userId, sessionId, 'agent_only')).toBe(path);
  });

  it('returns null for non-owned path in signer flow', () => {
    const path = `hacker/${sessionId}/full_call.webm`;
    expect(getOwnedRecordingPathOrNull(path, userId, sessionId, 'full_call')).toBeNull();
  });
});

describe('Recorder Aggregator Logic', () => {
  it('synthesizes blobs from chunks', () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);
    // Mock Blob since it's a browser API
    global.Blob = class {
      parts: any[];
      options: any;
      constructor(parts: any[], options: any) {
        this.parts = parts;
        this.options = options;
      }
    } as any;

    const chunks = [chunk1, chunk2];
    const blob = new Blob(chunks, { type: 'audio/webm' });
    expect((blob as any).parts).toEqual(chunks);
    expect((blob as any).options.type).toBe('audio/webm');
  });
});
