# Telefun QA Assessment — Complete Findings & Remediation Plan

> **Tanggal:** 2026-05-10
> **Status:** P0 ✅ | P1 ✅ | P2 ✅

**Goal:** Memperbaiki defect reliability, security, dan performa yang ditemukan dalam QA assessment read-only terhadap seluruh module Telefun.

**Cakupan:** Server actions, proxy WebSocket, client runtime, voice assessment, settings parsing, storage lifecycle, metrics, UI performance.

**Verifikasi akhir:** `npm run lint` + `npm run type-check` + `npx vitest run tests/telefun` + `npm run telefun:build`

---

## Ringkasan Temuan

| Severity | Kategori | Temuan | Evidence |
|---|---|---|---|
| P0 | Data Loss | Usage live bisa hilang pada client close/error atau Gemini error karena `flushUsage()` hanya dipanggil saat Gemini `close` | `apps/telefun-server/src/server.ts:137-153`, `275-288`; audit test import `.worktrees/...` |
| P0 | State Corruption | Saved `telefunTransport` tidak diparse. Reload default ke `gemini-live`, potensi kirim model OpenAI ke Gemini Live | `app/(main)/telefun/constants.ts:43-52`; `geminiService.ts:548-564` |
| P1 | Auth Weakness | `persistTelefunSession()` menerima `userId` dari client tanpa explicit server-side auth match | `app/(main)/telefun/actions.ts:217-247` |
| P1 | Silent Failure | `finalizeTelefunRecording()` result diabaikan. Upload sukses tapi DB path gagal → assessment gagal | `TelefunClient.tsx:274-299`; `voiceAssessment.ts:106-113` |
| P1 | Reliability | Voice assessment tidak punya retry/timeout untuk transient Gemini 429/500/timeout | `voiceAssessment.ts:141-156`; `voiceAssessmentTimeout.ts`; `app/actions/gemini.ts:109-126` |
| P1 | Security | `analyzeVoiceQuality()` download tanpa validasi path exact (bandingkan signer flow) | `voiceAssessment.ts:85-113`; `actions.ts:376-383` |
| P1 | Data Quality | `SessionMetrics` fields dideklarasi tapi tidak diupdate: `volumeSamples`, `inputTranscriptionChunks`, `deadAirCount`, `interruptionCount` | `geminiService.ts:205-214`, `781-824`, `913-917`, `1120-1234` |
| P2 | UX Misleading | Label tab "Kualitas Suara AI" padahal menganalisis suara agen | `ReviewModal.tsx:100-105`; `VoiceAssessmentSection.tsx:62-64` |
| P2 | Memory Leak | Blob URL dibuat via `URL.createObjectURL()` tanpa revoke | `geminiService.ts:1198` |
| P2 | Scoring Weak | Score hanya berdasar scenario + durasi, bukan transcript/audio/metrics | `geminiService.ts:1599-1644` |
| P2 | Performance | Modal besar diimport eager; ScriptProcessorNode deprecated; volume UI update ~20Hz; recording chunks di memory; layout belum safe-area friendly | `TelefunClient.tsx:5-9`; `geminiService.ts:633-760`, `1198`; `PhoneInterface.tsx:435-559` |
| P2 | Observability | Timeline console-only, belum ada performance marks untuk connect/first audio/upload | `geminiService.ts:220-229`; `SpeedInsights` global |

## Functional Test Scenarios

| # | Skenario | Status |
|---|---|---|
| 1 | Login, `/telefun`, warning gate, mulai call, mic permission granted, status `Tersambung`, AI response | 🔲 smoke |
| 2 | Mic permission denied, proxy mati, token expired, origin tidak diizinkan, setup timeout | 🔲 error paths |
| 3 | No active scenario, auth belum ready, partial identity fields, random scenario/consumer | 🔲 gating |
| 4 | Mute, hold, timeout auto hangup, short acknowledgment, valid interruption, dead-air prompt | 🔲 runtime |
| 5 | End call → `telefun_history` row, `results` row, `full_call.webm`, `agent_only.webm`, review modal auto-open | 🔲 persist |
| 6 | Delete satu session & clear all history → DB, results, storage ikut terhapus | 🔲 cleanup |
| 7 | Review lama → signed URL playback, expired URL behavior | 🔲 playback |
| 8 | Voice assessment: normal, missing `agent_only`, invalid cached, malformed JSON, transient Gemini error | 🔲 assessment |
| 9 | Model setting: Gemini default, invalid/legacy model, OpenAI audio disabled | 🔲 settings |
| 10 | Usage baseline → post-session delta → all close/error paths flush | 🔲 billing |

## Edge Cases

| # | Case | Risk |
|---|---|---|
| 1 | Call sangat pendek → empty/tiny `agent_only.webm` | Assessment gagal tanpa pesan jelas |
| 2 | Call panjang mendekati 50MB storage limit | Upload gagal |
| 3 | Full-call upload sukses, agent-only gagal (atau sebaliknya) | Partial data flow |
| 4 | Storage upload sukses tapi `finalizeTelefunRecording()` gagal | UI menampilkan path tapi DB kosong |
| 5 | LocalStorage corrupt, stale DB schema fallback | History tidak muncul |
| 6 | Browser tab background, route transition saat disconnect, double hangup | Recorder race condition |
| 7 | Cross-user session ID, tampered recording path, arbitrary bucket object | Security bypass |
| 8 | Mobile Safari/Chrome dynamic URL bar, notch, gesture area, low-memory | UX/layout break |

## Performance Risks

| Risk | Detail | Mitigation |
|---|---|---|
| Eager modal imports | `SettingsModal`, `HistoryModal`, `ReviewModal`, `UsageModal` loaded upfront | Dynamic import on open |
| Deprecated audio API | `createScriptProcessor` + main-thread downsample/base64 | Migrate to `AudioWorklet` |
| High-frequency UI updates | Volume analyzer ~20Hz → React state updates per frame | Throttle to 4-6Hz, DOM-only if possible |
| Memory pressure | Recording chunks held in memory until disconnect | Stream chunks if needed |
| Blob URL leak | `URL.createObjectURL()` without revoke | Revoke after modal close/download |
| No safe-area awareness | `fixed inset-0`, `h-full` tanpa `100dvh`/safe-area | Add safe-area CSS |
| No Telefun-specific perf marks | Only console timeline + global SpeedInsights | Add `performance.mark()` for key events |

---

## P0 Fixes (✅ Completed)

### P0.1 Usage Flush Hardening
**Files:** `apps/telefun-server/src/server.ts`
- Client close/error now closes Gemini first and uses a 2s fallback flush so final `usageMetadata` can arrive before persistence
- Gemini close/error paths still flush directly
- Idempotensi dijaga via existing `usageFlushed` flag

### P0.2 telefunTransport Parsing
**Files:** `app/(main)/telefun/constants.ts`
- Added `telefunTransport` parsing in `parseTelefunSettings()`: valid values `'gemini-live'` | `'openai-audio'`, default `'gemini-live'`
- `SettingsModal` already saves `telefunTransport` correctly on save

---

## P1 Implementation Plan

### P1.1: Add Explicit Auth Check in persistTelefunSession
**Files:** `app/(main)/telefun/actions.ts:229-231`
- Add `getUser()` check and compare `params.userId` to authenticated `user.id`
- Return error if mismatch

### P1.2: Handle finalizeTelefunRecording Failure in Client
**Files:** `app/(main)/telefun/TelefunClient.tsx:274-283`
- Check `finalizeTelefunRecording()` result
- If failed, clear `recordingPath`/`agentRecordingPath` from serverRecord so UI reflects truth

### P1.3: Add Transient Retry for Voice Assessment
**Files:** `app/actions/voiceAssessment.ts:141-156`; `app/actions/voiceAssessmentTimeout.ts`
- Wrap `generateGeminiContent()` call in retry loop (max 4 attempts: 0ms instant, 1s, 2s, 4s backoff)
- Retry on transient errors (429, 500, 503, timeout, ETIMEDOUT)
- Add explicit 45s per-attempt timeout with `AbortSignal` propagation to `@google/genai` so hung model requests fail into the same transient retry path without overlapping local retries

### P1.4: Add Path Validation in analyzeVoiceQuality Download
**Files:** `app/actions/voiceAssessment.ts:110-113`
- Validate `agent_recording_path` with `isValidRecordingPath()` before admin storage download
- Return clear error if path is invalid

### P1.5: Populate Session Metrics Counters
**Files:** `app/(main)/telefun/services/geminiService.ts`
- `trackDeadAir()` → increment `this.deadAirCount` when dead-air prompt fires
- `sendInterruptionPrompt()` → increment `this.interruptionCount`
- `analyzeVolume()` → push normalized volume to `this.volumeSamples`
- `handleMessage()` → push transcription text to `this.inputTranscriptionChunks`
- `getSessionMetrics()` persists only the latest 600 volume samples and latest 100 input transcription chunks

---

## P2 Implementation Plan

### P2.1: Revoke Blob URL After Use
**Files:** `app/(main)/telefun/TelefunClient.tsx:391-422`; `app/(main)/telefun/recordingUrl.ts`
- Browser-only `blob:` URLs are not persisted to server rows
- Browser-only `blob:` URLs are also stripped from localStorage cache writes and cache reads to avoid stale playback entries after reload
- If `recordingPath` exists, server records use signed-url fetch via `ReviewModal` instead of retaining stale blob URLs
- If storage path is unavailable, local blob playback is preserved and the optimistic blob URL is not revoked during server record replacement
- Revoke blob URLs when records are deleted or history cleared via `handleDeleteSession`/`handleClearHistory`
- Blob URLs persist during review modal lifecycle and get cleaned up when no longer referenced

### P2.2: Fix UI Label — "Kualitas Suara AI" → "Kualitas Suara Agen"
**Files:** `app/(main)/telefun/components/ReviewModal.tsx:100-105`; `app/(main)/telefun/components/VoiceAssessmentSection.tsx:62-64`
- Change label texts to reflect that this analyzes agent voice, not AI voice

### P2.3: Dynamic Import Large Modals
**Files:** `app/(main)/telefun/TelefunClient.tsx:5-9`, `530-555`
- Convert `SettingsModal`, `HistoryModal`, `ReviewModal`, `UsageModal` to `dynamic()` imports

### P2.4: Safe-Area & Mobile Layout Fixes
**Files:** `app/(main)/telefun/components/PhoneInterface.tsx:435-559`; `TelefunClient.tsx:518`
- Add `100dvh`, `env(safe-area-inset-bottom)` for active call controls
- Add safe-area padding to bottom controls
- Add single-column override for ReviewModal grid on small screens

---

*File ini dibuat dari hasil QA assessment read-only pada 2026-05-10.*
*Verifikasi terakhir: focused regressions `npx vitest run tests/telefun/recording-url.test.ts tests/telefun/live-session-metrics.test.ts` dan `npx vitest run tests/telefun/voice-assessment-timeout.test.ts` pass setelah fix.*
