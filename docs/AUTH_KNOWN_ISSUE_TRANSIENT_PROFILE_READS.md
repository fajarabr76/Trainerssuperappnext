# Auth Known Issue — Transient Profile Reads

## Status

- Status: `resolved in worktree`
- Prioritas: `high`
- Dampak: login untuk user valid, terutama role `agent`, bisa terlihat gagal karena sesi dihancurkan saat pembacaan `profiles` gagal sementara.

## Gejala

1. User berhasil melewati `signInWithPassword`, tetapi setelah itu kembali ke landing page atau terlihat seperti gagal login.
2. Role `agent` paling mudah terlihat terdampak karena jalur login dan guard berikutnya membaca `profiles` segera setelah sesi aktif.
3. Error atau warning terkait pembacaan `profiles` muncul walaupun kredensial benar.

## Akar Masalah Final

1. **Post-login verification terlalu fail-closed** — alur login client dulu menganggap `profiles` yang gagal dibaca sebagai alasan untuk `signOut()`.
2. **Middleware ikut menghancurkan sesi pada read failure** — protected-route gate di middleware sempat memutus sesi hanya karena profil belum terbaca jelas.
3. **Dokumentasi auth lama mengabadikan model fail-closed** — dokumen guardrail masih menulis `No-Profile-No-Entry`, sehingga refactor berikutnya berisiko mengembalikan bug yang sama.

## Fix Yang Menjadi Baseline

### 1. AuthModal harus menunggu sesi aktif lalu route by status

- `pending` -> `/waiting-approval`
- `rejected` -> `signOut()` + error
- selain itu -> `/dashboard`
- jika baca `profiles` gagal sementara, jangan langsung `signOut()`

### 2. Middleware hanya hard-fail untuk state terminal

- guest tanpa sesi -> `/?auth=login`
- `pending` -> `/waiting-approval`
- `rejected` / `is_deleted` -> sign-out + redirect
- profile read transient failure -> log warning, pertahankan sesi

### 3. Server-side guard harus konsisten dengan model toleran

- `requirePageAccess()` tetap menangani guest, pending, rejected, deleted, dan unauthorized role
- profile yang belum terbaca jelas tidak boleh otomatis dianggap sesi invalid

## Source of Truth

- `app/components/AuthModal.tsx`
- `app/lib/supabase/middleware.ts`
- `app/lib/authz.ts`
- `docs/auth-rbac.md`

## Regression Guard

- [ ] Login akun `approved` role `agent` berhasil masuk ke `/dashboard`.
- [ ] Login akun `pending` tetap ke `/waiting-approval`.
- [ ] Login akun `rejected` tetap gagal dengan sign-out dan pesan yang sesuai.
- [ ] Kegagalan baca `profiles` yang transient tidak lagi menghancurkan sesi aktif.
- [ ] Akses route terbatas setelah login `agent` tetap ditolak oleh matrix role, bukan diperlakukan sebagai kegagalan login.

## Smoke Steps Singkat

1. Login dengan akun `agent` yang sudah `approved`.
2. Pastikan user masuk ke `/dashboard` dan tidak kembali ke landing page.
3. Coba akses route yang dibatasi untuk `agent`; pastikan hasilnya adalah redirect/deny yang sesuai, bukan logout.
4. Ulangi untuk akun `pending` dan `rejected`.
5. Jika ada perubahan pada kontrak `profiles`, ulangi smoke test ini sebelum commit/push.
