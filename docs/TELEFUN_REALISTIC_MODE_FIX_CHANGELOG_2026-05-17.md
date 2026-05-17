# Telefun Realistic Mode — Parser & Runtime Wiring Fix

**Date:** 2026-05-17

## Summary

Memperbaiki dua critical bugs pada realistic mode Telefun:
1. `parseTelefunSettings()` tidak mengembalikan `realisticModeEnabled` dan `realisticModeDisruptionTypes` (hilang setelah page reload).
2. `LiveSession.setRealisticMode()` tidak pernah dipanggil dari runtime call flow (seluruh engine realistis adalah dead code).

## Changes

### Parser fix (`app/(main)/telefun/constants.ts`)
- `parseTelefunSettings()` sekarang mengekstrak `realisticModeEnabled` (coerce ke boolean, default `false`) dan `realisticModeDisruptionTypes` (filter valid types, max 3, default `[]`).
- Menambahkan helper `parseDisruptionTypes()` dan konstanta `VALID_DISRUPTION_TYPES`.

### Defaults (`app/(main)/telefun/data.ts`)
- `defaultTelefunSettings` sekarang menyertakan `realisticModeEnabled: false` dan `realisticModeDisruptionTypes: []`.

### Resolver (`app/(main)/telefun/services/resolveRealisticModeConfig.ts`) [NEW]
- Fungsi `resolveTelefunRealisticModeConfig(config)` memetakan `SessionConfig` ke `RealisticModeConfig`.
- Mapping consumer type ID ke engine persona:
  - `marah` → `angry`, `bingung` → `confused`, `kritis` → `critical`
  - `ramah` → `cooperative`, `terburu-buru` → `rushed`, `pasrah` → `passive`
  - Custom/unknown → `cooperative` (fallback aman).
- Filter disruption types (valid + max 3).

### Runtime wiring (`app/(main)/telefun/components/PhoneInterface.tsx`)
- Setelah `new LiveSession(config)` dan sebelum `session.connect()`, panggil `session.setRealisticMode(resolveTelefunRealisticModeConfig(config))`.

### UI rename (`app/(main)/telefun/components/SettingsModal.tsx`)
- "Realistis" → "Natural" (opsi tempo).
- "Cepat untuk Latihan" → "Cepat".
- "Mode Realistis" → "Mode Simulasi Realistis" dengan helper text yang menjelaskan perbedaan dengan tempo bicara.
- Helper text diperbarui untuk membedakan "tempo bicara" vs "simulasi realistis".

### Dokumentasi
- `docs/TELEFUN_OPERATIONAL_RUNBOOK.md` diperbarui dengan bagian "Mode Simulasi Realistis" dan persona mapping.
- Changelog ini ditambahkan.

## Files Changed

| File | Change |
|---|---|
| `app/(main)/telefun/constants.ts` | Parser fix + helper function |
| `app/(main)/telefun/data.ts` | Added defaults |
| `app/(main)/telefun/services/resolveRealisticModeConfig.ts` | NEW: resolver function |
| `app/(main)/telefun/components/PhoneInterface.tsx` | Added realistic mode wiring |
| `app/(main)/telefun/components/SettingsModal.tsx` | UI copy rename |
| `tests/telefun/telefun-settings-model-default.test.ts` | Added parser tests |
| `tests/telefun/resolve-realistic-mode-config.test.ts` | NEW: resolver tests |
| `docs/TELEFUN_OPERATIONAL_RUNBOOK.md` | Updated documentation |

## Risks

- Engine realistic mode yang sebelumnya dead code sekarang aktif saat toggle ON.
- Smoke test 4 kombinasi wajib sebelum deploy.
- Tidak ada migration DB baru — kolom sudah ada (additive).
- Rollback: revert PhoneInterface wiring untuk nonaktifkan engine runtime.
