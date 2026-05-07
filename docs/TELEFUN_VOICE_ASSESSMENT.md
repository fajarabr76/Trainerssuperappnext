# Telefun AI Voice Assessment

## Overview
The Voice Assessment feature provides automated analysis of an agent's vocal performance during Telefun simulations. It evaluates metrics such as speaking rate, intonation, articulation, and emotional tone using `gemini-3.1-flash-lite-preview`.

## Architecture

### 1. Dual-Recorder System
- **Location:** `app/(main)/telefun/services/geminiService.ts`
- **Mechanism:** When a session starts, two `MediaRecorder` instances are initialized:
    - **Recorder A (Full Call):** Captures the mixed stream (Agent + Consumer AI).
    - **Recorder B (Agent Only):** Captures only the microphone input.
- **Aggregation:** `LiveSession` coordinates both recorder streams and emits recording output once via `emitRecordingCompleteOnce()` at session disconnect, with a 1s fallback timer to prevent hung sessions.

### 2. Storage Lifecycle
- **Bucket:** `telefun-recordings` (Private)
- **Path Pattern:** `{userId}/{sessionId}/full_call.webm` and `{userId}/{sessionId}/agent_only.webm`
- **Security:** 
    - RLS policies restrict access to the owner's `userId` folder.
    - Public access is disabled. 
    - Playback requires a Signed URL (valid for 3600 seconds) generated via `getTelefunSignedUrl`.

### 3. Assessment Pipeline
- **Trigger:** On-demand via the "Mulai Analisis" button in the `ReviewModal`.
- **Action:** `analyzeVoiceQuality(sessionId)` (Server Action).
- **Process:**
    1. Authenticates user and verifies ownership of the session.
    2. Downloads `agent_only.webm` from private storage using the Admin Client.
    3. Sends audio + scenario context to `gemini-3.1-flash-lite-preview` with a structured JSON schema.
    4. Validates AI output strictly before persistence:
       - assessment root must be object
       - required aspects (`speakingRate`, `intonation`, `articulation`, `fillerWords`, `emotionalTone`) must exist
       - all score fields are clamped to range `0-10`
    5. Persists only valid `VoiceQualityAssessment` payload to `telefun_history.voice_assessment`.
    6. If cached assessment is malformed, cache is ignored and analysis is re-run.

## Data Schema

### VoiceQualityAssessment
```typescript
{
  overallScore: number; // 0-10
  speakingRate: {
    score: number;
    wordsPerMinute: number;
    verdict: string;
    feedback: string;
  };
  intonation: VoiceAspectScore;
  articulation: VoiceAspectScore;
  fillerWords: {
    score: number;
    count: number;
    examples: string[];
    verdict: string;
    feedback: string;
  };
  emotionalTone: {
    score: number;
    dominant: string;
    verdict: string;
    feedback: string;
  };
  transcript: string;
  highlights: string[];
  strengths: string[];
}
```

## SessionMetrics (Real-time Call Metrics)

Collected client-side during live calls and persisted alongside the history record:

```typescript
{
  speechSegments: SpeechSegment[];   // individual speaking bursts
  totalSpeakingMs: number;
  totalSilenceMs: number;
  deadAirCount: number;
  interruptionCount: number;
  volumeSamples: number[];
  volumeConsistency: number;         // 0-100, stddev-based
  inputTranscriptionChunks: string[];
  sessionDurationMs: number;
}
```

## Recording Finalization Flow

Recording persistence uses a **two-step pattern** to handle the async nature of browser MediaRecorder:

1. `persistTelefunSession()` — inserts the history row immediately at call end (no recording paths yet).
2. After blobs are uploaded to Supabase Storage, `finalizeTelefunRecording()` updates `recording_path` and `agent_recording_path` via Admin Client.

Path validation is enforced by `recordingPath.ts` — only exact `{userId}/{sessionId}/{type}.webm` patterns are accepted, preventing directory traversal and cross-user access.

## Review Modal Auto-Open Flow

After a call ends, the review modal opens automatically with the **server record** (not the optimistic record) to ensure `agentRecordingPath` is available:

1. Call ends → `handleEndCall()` receives blobs from `PhoneInterface`.
2. Session is persisted via `persistTelefunSession()` → returns server record with DB-generated UUID.
3. Blobs are uploaded to Supabase Storage → paths captured in `recordingPath` / `agentRecordingPath`.
4. `setRecordings()` merges the server record into state, replacing the optimistic entry.
   - **Note:** `serverRecord` is calculated **outside** the state updater to avoid React 18 batching race conditions, ensuring the Review Modal opens immediately with complete data.
5. Review modal opens with the server record, which includes `agentRecordingPath` → "Mulai Analisis" button is enabled.

**Fallback paths** (all open review with optimistic data, button may be disabled):

| Trigger | Behavior |
|---|---|
| Server record already exists in state (`alreadyHasServerRecord`) | Reuse existing record from state |
| `persistTelefunSession()` fails | Open review with optimistic data |
| User not authenticated (`!user`) | Open review with optimistic data |
| Upload fails (storage error) | Open review with partial data (paths may be undefined) |

## DB Migration

- **Migration files:** 
  - `supabase/migrations/20260428000000_create_telefun_history.sql` (Initial table)
  - `supabase/migrations/20260507000000_telefun_voice_assessment.sql` (Storage & JSONB columns)
  - `supabase/migrations/20260507203000_fix_missing_telefun_columns.sql` (Restored `score`, `feedback`, `created_at` columns)
- **Storage bucket:** `telefun-recordings` (private, 50MB limit, webm/ogg/mp4 MIME types)
- **RLS policies:** INSERT, SELECT, DELETE scoped to `auth.uid()`
- **Known issue:** The `score` and `feedback` columns were missing in production until the 20260507203000 migration was applied, causing session persistence failures.

## Security & Compliance
- **PII Protection:** Audio recordings are stored in a private bucket with folder-level isolation.
- **Cleanup:** `deleteTelefunSession` and `clearTelefunHistory` perform hard-deletion of all associated audio files from storage before removing database records.
- **Integrity:** Database updates for assessment scores are performed via Admin Client in server actions to prevent client-side tampering.
- **Path Validation:** `isValidRecordingPath()` and `getOwnedRecordingPathOrNull()` enforce strict ownership checks on all recording operations.

## File Map

| File | Purpose |
|---|---|
| `app/actions/voiceAssessment.ts` | Server action: AI voice analysis via Gemini |
| `app/types/voiceAssessment.ts` | Type definitions: `VoiceQualityAssessment`, `SessionMetrics` |
| `app/lib/voiceAssessmentUtils.ts` | Validator/sanitizer for AI output |
| `app/(main)/telefun/recordingPath.ts` | Path validation security util |
| `app/(main)/telefun/components/VoiceAssessmentSection.tsx` | UI: assessment trigger + results display |
| `app/(main)/telefun/components/VoiceRadarChart.tsx` | UI: radar chart (lazy loaded) |
| `app/(main)/telefun/components/ReviewModal.tsx` | UI: review modal with voice tab |
| `app/(main)/telefun/actions.ts` | Server actions: `finalizeTelefunRecording`, `getTelefunSignedUrl` |
| `supabase/migrations/20260507000000_telefun_voice_assessment.sql` | DB migration |

## Troubleshooting
- **No Audio in Assessment:** Ensure microphone permissions were granted and `agent_only.webm` exists. Missing full-call recorder alone should not block assessment.
- **Assessment Timeout:** `gemini-3.1-flash-lite-preview` may take 5-15 seconds for long recordings (>3 mins).
- **Signed URL Expired:** Refresh the Review Modal to generate a new URL.
