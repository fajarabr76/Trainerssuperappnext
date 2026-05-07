# Telefun Voice Stability Investigation and Repair v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menstabilkan live voice Telefun lewat observability, validasi alur runtime, hardening interruption, dan recovery stalled-response tanpa refactor besar di iterasi awal.

**Architecture:** Iterasi dimulai dari instrumentation client+proxy untuk mendapatkan timeline fakta per sesi berbasis correlation ID. Setelah sumber masalah terlihat, guard interruption dan stalled-response ditambah dalam helper pure yang dapat diuji, lalu runtime state diangkat ke state machine internal sebagai source of truth event handling. Recovery dibuat bertingkat dan idempotent per turn agar tidak memicu respons AI ganda.

**Tech Stack:** Next.js App Router (client runtime Telefun), TypeScript, Vitest, standalone Node WebSocket proxy (`apps/telefun-server`), Gemini Live transport.

---

## Scope and Guardrails

- Tidak mengganti provider/transport utama (`gemini-live`) dan tidak melakukan rewrite arsitektur besar di fase awal.
- Perubahan fokus ke:
  - `app/(main)/telefun/components/PhoneInterface.tsx`
  - `app/(main)/telefun/services/geminiService.ts`
  - `app/(main)/telefun/services/timingGuards.ts` + helper baru setara
  - `apps/telefun-server/src/server.ts`
  - `tests/telefun/*` untuk helper/state-machine tests
  - `docs/TELEFUN_OPERATIONAL_RUNBOOK.md` + docs indeks yang relevan
- Backward-compatible: jika correlation ID dibawa lewat setup/metadata, format lama tetap diterima.
- Hindari retry buta; recovery wajib idempotent per turn/session.

## Task 1: Baseline Runtime Mapping and Event Inventory

**Files:**
- Read: `app/(main)/telefun/services/geminiService.ts`
- Read: `app/(main)/telefun/components/PhoneInterface.tsx`
- Read: `apps/telefun-server/src/server.ts`

- [ ] **Step 1: Verifikasi event yang sudah ada**

Run:
```bash
rg -n "setupComplete|modelTurn|turnComplete|interrupted|onopen|onclose|onerror|dead-air|hold|disconnect|WebSocket" \
  "app/(main)/telefun/services/geminiService.ts" \
  "app/(main)/telefun/components/PhoneInterface.tsx" \
  "apps/telefun-server/src/server.ts"
```

Expected: event runtime tersebar di client+proxy dan belum punya timeline terstruktur lintas layer.

- [ ] **Step 2: Tetapkan taxonomy gejala investigasi (dipakai lintas fase)**

Kategori wajib:
- setup sukses tapi model tidak respon
- model respon tapi playback tidak mulai
- model berhenti karena `interrupted`
- AI terlihat diam karena dead-air/silence path
- socket/proxy/Gemini close di tengah giliran

## Task 2: Client Timeline Instrumentation + Correlation ID

**Files:**
- Modify: `app/(main)/telefun/services/geminiService.ts`
- Modify: `app/(main)/telefun/components/PhoneInterface.tsx`
- Modify: `app/(main)/telefun/types.ts` (atau file type Telefun yang setara)

- [ ] **Step 1: Tambah type event timeline client**

Tambahkan type eksplisit:
- `TelefunSessionState` (placeholder untuk Task 4 state machine)
- `TelefunTimelineEvent` (`event`, `ts`, `sessionId`, `turnId?`, `meta`)

- [ ] **Step 2: Tambah correlation ID per session call**

Aturan:
- Dibuat saat call dimulai.
- Disimpan di runtime sesi.
- Dikirim ke proxy lewat setup payload/metadata internal yang backward-compatible.

- [ ] **Step 3: Instrument event minimum di client**

Daftar event:
- `connect_start`
- `mic_ready`
- `ws_open` / `ws_close`
- `setup_sent`
- `setup_complete_received`
- `audio_chunk_send` (cadence ringkas, bukan spam semua chunk)
- `first_model_audio_chunk`
- `turn_complete_received`
- `interrupted_received`
- `playback_start` / `playback_end`
- `dead_air_prompt_sent`
- `interruption_prompt_sent`
- `disconnect` (dengan reason terstruktur)

- [ ] **Step 4: Pastikan log aman untuk produksi**

Aturan:
- Hindari logging token/raw audio.
- Ringkas payload sensitif.
- Prefix konsisten: `[Telefun][Timeline]`.

## Task 3: Proxy Timeline Instrumentation and Pairing

**Files:**
- Modify: `apps/telefun-server/src/server.ts`

- [ ] **Step 1: Tambah correlation pairing di proxy**

Sumber ID:
- Utamakan ID dari setup client.
- Fallback ke requestId existing saat belum ada.

- [ ] **Step 2: Instrument event minimum di proxy**

Daftar event:
- `client_connected`
- `auth_passed`
- `gemini_ws_open`
- `client_setup_forwarded`
- `pending_message_flushed`
- `usage_metadata_seen`
- `first_model_turn`
- `turn_complete`
- `interrupted`
- `gemini_error`
- `close_path` (siapa yang close duluan + close code/reason)

- [ ] **Step 3: Tambah close reason taxonomy**

Bedakan eksplisit:
- transport failure
- auth/setup failure
- gemini upstream close
- client initiated close

## Task 4: Turn-Taking Guard Hardening (Without Big Refactor)

**Files:**
- Create: `app/(main)/telefun/services/interruptionGuards.ts` (nama bisa disesuaikan)
- Modify: `app/(main)/telefun/services/geminiService.ts`
- Modify: `app/(main)/telefun/services/timingGuards.ts` (jika ada helper yang perlu dipindah/dirapikan)

- [ ] **Step 1: Audit config `automaticActivityDetection` aktif sekarang**

Run:
```bash
rg -n "automaticActivityDetection|startOfSpeechSensitivity|endOfSpeechSensitivity" \
  "app/(main)/telefun/services/geminiService.ts"
```

- [ ] **Step 2: Tambah helper klasifikasi interruption yang pure-testable**

Konsep minimum:
- `noise`
- `short_acknowledgment_candidate`
- `valid_interruption_candidate`
- `stalled_ai_response`

- [ ] **Step 3: Implement guard desain interruption**

Guard wajib:
- durasi minimum non-silent sebelum interruption valid
- grace period saat AI baru mulai bicara
- cooldown setelah interruption accepted/rejected
- reject audio terlalu pendek atau amplitudo mendekati noise floor

- [ ] **Step 4: Integrasikan guard ke runtime tanpa ubah behavior dead-air utama**

Aturan:
- dead-air dan long-speech tetap ada
- prioritas event dipagar supaya tidak overlap liar dengan interruption baru

## Task 5: Explicit Client Session State Machine

**Files:**
- Create: `app/(main)/telefun/services/sessionStateMachine.ts`
- Modify: `app/(main)/telefun/services/geminiService.ts`
- Modify: `app/(main)/telefun/components/PhoneInterface.tsx`
- Test: `tests/telefun/session-state-machine.test.ts`

- [ ] **Step 1: Definisikan state dan transition table**

State minimum:
- `idle`
- `connecting`
- `ready`
- `user_speaking`
- `ai_thinking`
- `ai_speaking`
- `interruption_candidate`
- `recovering`
- `ended`

- [ ] **Step 2: Kunci transition penting sesuai kontrak**

Transisi minimum:
- `setupComplete`: `connecting -> ready`
- valid user audio saat AI diam: `ready -> user_speaking`
- end user turn: `user_speaking -> ai_thinking`
- first model audio: `ai_thinking -> ai_speaking`
- interruption lolos guard: `ai_speaking -> interruption_candidate -> user_speaking`
- stream broken/no response: `-> recovering`
- hard close: `-> ended`

- [ ] **Step 3: Jadikan state machine source of truth internal**

Catatan:
- UI tidak wajib di-refactor total.
- UI baca derived status dari state machine.

## Task 6: Stalled-Response Watchdog and Recovery

**Files:**
- Create: `app/(main)/telefun/services/stalledResponseGuards.ts` (atau gabung helper interruption jika kecil)
- Modify: `app/(main)/telefun/services/geminiService.ts`
- Modify: `apps/telefun-server/src/server.ts` (jika butuh ping/nudge internal path)

- [ ] **Step 1: Tambah watchdog timeout terpisah**

Jenis timeout:
- connect/setup timeout
- response-start timeout (setup complete + user turn selesai tapi belum ada model turn)
- mid-response stream timeout
- websocket transport failure

- [ ] **Step 2: Implement recovery bertingkat**

Level:
- L1: mark `recovering` + timeline log `stalled_response`
- L2: kirim soft nudge aman (sekali per turn/session window)
- L3: terminate session dengan structured reason bila stream tetap macet

- [ ] **Step 3: Idempotency guard**

Aturan:
- recovery tidak boleh memicu giliran AI ganda
- setiap turn punya token/flag recovery sendiri

## Task 7: Unit Tests and Regression Tests

**Files:**
- Create: `tests/telefun/interruption-classification.test.ts`
- Create: `tests/telefun/stalled-response-guards.test.ts`
- Create: `tests/telefun/session-state-machine.test.ts`
- Keep/Extend: `tests/telefun/interruption-timeout.test.ts`

- [ ] **Step 1: Tambah test klasifikasi interruption**

Kasus wajib:
- short sound ditolak
- noise kecil ditolak
- interruption butuh durasi minimum
- grace period AI speaking mencegah stop dini

- [ ] **Step 2: Tambah test stalled detector**

Kasus wajib:
- detector aktif hanya di state yang benar (`ai_thinking`/waiting response)
- setupComplete tanpa modelTurn memicu recovery

- [ ] **Step 3: Tambah test state transitions utama**

Kasus wajib:
- jalur normal user->ai
- interruption valid menghentikan AI sekali
- modelTurn masuk tapi playback gagal tetap diklasifikasikan playback-layer issue

## Task 8: Docs and Operational Smoke Update

**Files:**
- Modify: `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`
- Modify: `docs/modules.md` (jika ada ringkasan behavior Telefun)
- Optional: `docs/README.md` index entry jika perlu

- [ ] **Step 1: Update runbook observability baru**

Masukkan:
- arti setiap timeline event penting
- cara pairing log client-proxy via correlation ID
- cara bedakan transport vs playback vs turn-taking issue

- [ ] **Step 2: Update smoke checklist Telefun**

Checklist minimum:
- AI lanjut saat user hanya “iya/oke/hmm”
- AI berhenti hanya saat interupsi valid/cukup panjang
- setup sukses tapi model diam masuk recovery path jelas
- close reason dan timeout type terlihat jelas di log

## Verification Gates (Per PR / Sebelum Merge)

- [ ] `npm run lint`
- [ ] Focused Telefun tests (`npx vitest run tests/telefun/*.test.ts`)
- [ ] `npm run telefun:build`
- [ ] Manual smoke Telefun call:
  - short acknowledgment scenario
  - valid long interruption scenario
  - silence/stalled scenario

## Exit Criteria v1

- Timeline client+proxy cukup untuk memutuskan akar masalah dominan per incident.
- Short acknowledgment tidak lagi menghentikan AI secara prematur.
- Stalled-response path terdeteksi dan ditangani dengan recovery bertingkat yang idempotent.
- Session runtime memakai state machine eksplisit minimal untuk transisi kritis.
- Dokumentasi operasional sinkron dengan behavior baru.
