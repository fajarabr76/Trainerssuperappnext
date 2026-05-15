# Changelog: Telefun Manual Hold Consent & WPM Fix

**Date:** 2026-05-15

## Summary

Hold di Realistic Mode menjadi **UI-only**: frasa seperti "Mohon ditunggu" tidak lagi mengaktifkan hold otomatis. Frasa instruction hanya menjadi sinyal bahwa agent sudah meminta izin (consent request). Hold tanpa consent tetap aktif tetapi ditandai `rude_hold` dan menaikkan emotional intensity persona. WPM kini dihitung dari active speaking time, bukan total durasi sesi.

## Detailed Changes

### Hold Interface Refactor
- `HoldSource` diubah dari `'none' | 'ui' | 'nlp'` menjadi `'none' | 'ui'` saja
- `nlpInstructionDetected`, `activate_nlp_hold`, `buildActivateNlpResult`, dan semua NLP hold thresholds dihapus
- `HoldResult` ditambah `isRudeHold: boolean` dan `rudeHoldReason: RudeHoldReason`
- Tipe `RudeHoldReason`: `'no_request' | 'stale_request' | 'no_consumer_response' | null`

### Consent Context
- Interface baru `ConsentContext` dengan `lastHoldRequestAt` dan `lastConsumerResponseAt`
- **Hold Request**: tercatat di `RealisticModeOrchestrator.classifyAgentResponse()` saat hasil klasifikasi `'instruction'`
- **Consumer Response**: tercatat via callback `onConsumerResponse(now)` dari `geminiService.handleMessage()` saat `modelTurn.parts` mengandung audio
- **Valid consent**: request ≤ 15 detik + consumer response setelah request
- **Rude hold**: hold tetap aktif, tapi `isRudeHold=true` + persona escalation via `rude_hold` trigger

### Prolonged Silence Handler
- `holdSource` dihapus, diganti `uiHoldActive: boolean`
- `lastClassification` dihapus dari `ProlongedSilenceInput`
- `activate_hold_nlp` action dihapus
- `NLP_HOLD_THRESHOLDS` (30s/45s/60s) dihapus
- Instruction phrases tidak lagi mempengaruhi dead-air threshold

### Persona State Machine
- Trigger escalation baru: `'rude_hold'`
- Delta: +2 untuk angry/critical, +1 untuk persona lainnya

### Voice Dashboard (WPM)
- WPM kini memakai `totalSpeakingMs > 0 ? totalSpeakingMs : sessionDurationMs`
- Fungsi `computeWpm()` diekstrak sebagai pure function untuk testability

### Files Changed

| File | Change |
|------|--------|
| `app/(main)/telefun/services/realisticMode/holdStateManager.ts` | Hold interface refactor, consent validation |
| `app/(main)/telefun/services/realisticMode/prolongedSilenceHandler.ts` | NLP hold removal, uiHoldActive |
| `app/(main)/telefun/services/realisticMode/personaStateMachine.ts` | rude_hold trigger |
| `app/(main)/telefun/services/realisticMode/RealisticModeOrchestrator.ts` | Consent tracking, onConsumerResponse |
| `app/(main)/telefun/services/geminiService.ts` | Remove notifyNlpHoldDetected, add onConsumerResponse |
| `app/actions/voiceDashboard.ts` | WPM fix, extract computeWpm |
| `app/actions/replayAnnotation.ts` | Fix async export (pre-existing) |
| `.kiro/specs/telefun-realistic/requirements.md` | Update R3.4, R10 consent model |
| `.kiro/specs/telefun-realistic/design.md` | Update interfaces, properties, error handling |
| `tests/telefun-realistic/*.test.ts` | Rewrite tests for new contract (258 total) |

### Migration SQL Applied
- `create_telefun_coaching_summary` ✅
- `create_telefun_replay_annotations` ✅
- `telefun_realistic_mode_columns` ✅ (5 kolom baru di `telefun_history`)

### Verification
- ✅ 258 tests pass (16 files)
- ✅ Lint: 0 errors
- ✅ Type-check (full build): Compiled successfully
