# KETIK Known Issue — Timeout, Context Drift, and Monitoring History Gaps

## Status

- Status: `resolved`
- Prioritas: `high`
- Dampak: sesi KETIK bisa tetap menerima balasan setelah timer habis, transcript paragraf kehilangan line break, konsumen keluar dari konteks skenario, dan history baru tidak selalu tampil konsisten di monitoring setelah reload.

## Route Terdampak

- `/ketik`
- `/dashboard/monitoring`

## Gejala

1. Saat timer 5/10/15 menit habis, konsumen kadang masih membalas pesan agent alih-alih menutup percakapan secara natural.
2. Pesan agent atau konsumen yang berisi beberapa paragraf tampil sebagai satu blok panjang di simulasi chat dan transcript monitoring.
3. Konsumen kadang membahas topik baru yang tidak ada di skenario, misalnya menambah isu cetak SLIK ketika kasus awal hanya tentang penipuan.
4. Beberapa sesi KETIK selesai tersimpan di flow pengguna, tetapi tidak langsung terbaca konsisten di monitoring setelah halaman dimuat ulang.

## Akar Masalah Final

1. **Timeout lifecycle di client belum benar-benar terminal** — request AI biasa yang sudah in-flight masih bisa selesai setelah timer habis dan menjadwalkan balasan baru bila hasilnya tidak dibuang.
2. **Rendering transcript belum mempertahankan newline** — bubble chat dan modal transcript memakai render teks biasa sehingga `\n` diratakan menjadi satu paragraf.
3. **Guardrail skenario kurang tegas** — prompt konsumen belum cukup eksplisit membatasi fakta/topik hanya pada inti skenario dan pertanyaan agent yang relevan.
4. **Save path sesi terlalu bergantung pada client flow** — penyimpanan sesi dilakukan dari client-side insert, sehingga alur persistence, warning handling, dan cache refresh monitoring tidak terkonsolidasi.

## Fix Yang Diterapkan

### 1. Session lifecycle dibuat eksplisit dan terminal

- `ChatInterface.tsx` memakai `SessionPhase = 'active' | 'expired' | 'closed'`.
- Semua `setTimeout` balasan bertahap disimpan di `pendingTimeoutsRef` dan dibersihkan lewat `clearPendingTimeouts()` saat sesi berakhir atau komponen unmount.
- Saat `timeLeft` mencapai `0`, timeout finalization dieksekusi sekali: sesi dipindah ke `expired`, satu pesan penutup konsumen dihasilkan via prompt timeout khusus, lalu semua jalur balasan konsumen berikutnya dihentikan.
- Ditambahkan `sessionPhaseRef` untuk membuang hasil request AI biasa yang selesai setelah sesi tidak lagi `active`, sehingga race condition pasca-timeout tidak memunculkan balasan konsumen baru.

### 1a. Timeout close dinamis, satu kali, dan punya fallback

- `handleSessionTimeout()` memanggil `generateConsumerResponse()` dengan `extraPrompt` timeout khusus untuk menghasilkan alasan penutup yang natural.
- Guard `timeoutFinalizedRef` memastikan timeout close hanya dieksekusi satu kali walau ada render/efek ulang.
- Output timeout dinormalisasi menjadi satu segmen chat; jika AI gagal atau mengembalikan `[NO_RESPONSE]`, dipakai fallback statis singkat agar UX tetap konsisten.
- Aksi usage timeout dicatat sebagai `module='ketik'` dan `action='session_timeout'`.

### 1b. Timeout closing dibuat branch-aware

- `handleSessionTimeout()` sekarang membaca `last speaker` dari history sebelum mengirim prompt penutup.
- Jika pesan terakhir berasal dari `consumer`, prompt melarang model mengonfirmasi solusi, arahan, atau langkah yang tidak pernah dikirim agent.
- Jika pesan terakhir berasal dari `agent` tetapi tidak terdeteksi solusi eksplisit, prompt tetap netral dan hanya boleh menutup percakapan tanpa menyebut `solusi` atau `langkah`.
- Jika pesan terakhir berasal dari `agent` dan solusi eksplisit terdeteksi, model boleh memberi acknowledgement singkat satu kalimat lalu menutup percakapan.
- Wording instruksi waktu umum di `geminiService.ts` juga dinetralkan agar tidak berbenturan dengan branch-aware timeout prompt.

### 1c. Deteksi solusi dibuat lebih ketat

- `timeoutContext.ts` memisahkan cue instruksional menjadi tier yang lebih spesifik dan memakai boundary matching untuk kata tunggal agar substring yang kebetulan mirip tidak ikut terhitung.
- Struktur langkah diperiksa per baris dan baru dianggap cukup bila ada minimal dua langkah terformat.
- Ambang acknowledgement solusi sekarang hanya lolos bila sinyal instruksional memang kuat, sehingga false positive dari teks agent yang sekadar menjelaskan konteks biasa lebih kecil.

### 1d. UI timeout diselaraskan dengan perilaku baru

- Header KETIK tidak lagi switch ke label `Waktu Habis`; status tetap `Online` dengan timer elapsed.
- Banner composer `Waktu habis • Konsumen tidak akan membalas` dihapus.
- Composer tetap ditampilkan pada fase `active` maupun `expired` agar agen masih bisa menulis pesan akhir tanpa memicu balasan konsumen.

### 2. Transcript multiline dipertahankan

- Bubble chat KETIK memakai `whitespace-pre-wrap break-words`.
- Modal transcript monitoring KETIK memakai `whitespace-pre-wrap break-words`.
- Rendering tag `[SEND_IMAGE: indeks]` tetap dipertahankan sebagai gambar dan tidak diubah oleh fix whitespace.

### 3. Konteks skenario diperketat di prompt

- `generateConsumerResponse()` menambah aturan 15, 15a, 15b, dan 15c.
- Konsumen hanya boleh membahas fakta, isu, produk, atau layanan yang ada di `scenario.description`, `scenario.script`, atau pertanyaan agent yang masih relevan dengan masalah inti.
- Jika agent membawa topik di luar konteks, konsumen harus menolak dengan sopan lalu mengarahkan percakapan kembali ke inti kasus.

### 4. Save path sesi dipindah ke server action

- Ditambahkan `persistKetikSession()` di `app/(main)/ketik/actions.ts`.
- `ketik_history` tetap menjadi penyimpanan utama sesi KETIK.
- Insert ke `results` diperlakukan sebagai linkage sekunder dengan `legacy_history_id`; kegagalannya menjadi warning, bukan kegagalan total sesi.
- Setelah history utama berhasil, action melakukan `revalidatePath('/ketik')` dan `revalidatePath('/dashboard/monitoring')`.
- `KetikClient.tsx` sekarang memanggil server action ini alih-alih melakukan insert langsung dari browser.

### 5. Auth gate di UI diperjelas

- `authReady` menahan tombol `Mulai Simulasi` sampai status autentikasi selesai dibaca.
- Tombol `Selesai` di chat juga nonaktif bila auth belum siap.
- Jika sesi tidak bisa disimpan karena auth belum siap atau persistence gagal, pengguna mendapat pesan error yang jelas.

## Interface yang Berubah

- `persistKetikSession(params)` mengembalikan `success`, `session`, `warning`, dan `error`.
- `ChatInterface` menerima prop `authReady?: boolean`.
- `ChatInterface` memakai state internal `SessionPhase`, `sessionPhaseRef`, dan `timeoutFinalizedRef` untuk menjaga timeout close tetap satu kali dan sinkron terhadap request in-flight.

## Regression Guard

- [ ] Setelah timeout habis, konsumen hanya boleh menutup sesi sekali dan tidak boleh mengirim balasan baru dari request lama yang selesai belakangan.
- [ ] Input chat tetap tampil saat sesi `active` dan `expired`, tetapi balasan konsumen hanya boleh terjadi saat `active`.
- [ ] Bubble chat dan transcript monitoring harus mempertahankan line break multiline.
- [ ] Konsumen tidak boleh memperkenalkan topik baru di luar inti skenario.
- [ ] `ketik_history` tetap menjadi primary read path untuk monitoring KETIK.
- [ ] Linkage `results.details.legacy_history_id` tetap ada untuk sinkronisasi delete dan traceability.
- [ ] Insert `results` yang gagal tidak boleh menggagalkan penyimpanan `ketik_history`.
- [ ] Perubahan baru di KETIK tidak boleh menghapus `revalidatePath('/dashboard/monitoring')`.

## Smoke Steps Singkat

1. Mulai sesi KETIK berdurasi pendek, kirim pesan tepat menjelang `0:00`, lalu pastikan setelah timer habis tidak ada balasan konsumen tambahan dari request lama.
2. Kirim pesan agent dengan beberapa paragraf dan verifikasi bubble chat tetap multiline.
3. Selesaikan sesi lalu buka detail transcript di monitoring; pastikan paragraf tetap utuh.
4. Jalankan skenario penipuan dan coba bawa percakapan ke topik lain; pastikan konsumen mengarahkan kembali ke inti skenario.
5. Uji timeout dengan pesan terakhir dari consumer, lalu pastikan closing tidak mengonfirmasi solusi yang tidak pernah diberikan agent.
6. Uji timeout dengan pesan terakhir dari agent yang jelas memberi arahan, lalu pastikan acknowledgement singkat masih natural sebelum penutupan.
7. Akhiri sesi KETIK, reload `/dashboard/monitoring`, lalu pastikan history baru muncul.
8. Saat timeout sudah terjadi, kirim 2-3 pesan agent tambahan dan pastikan tidak ada balasan konsumen baru.

## Checklist Penutupan

- [ ] `npm run lint` pass.
- [ ] `npm run type-check` pass.
- [ ] `git diff --check` pass.
- [ ] Smoke manual timeout race pass.
- [ ] Smoke manual multiline transcript pass.
- [ ] Smoke manual monitoring reload pass.

## Referensi Silang

- `app/(main)/ketik/actions.ts`
- `app/(main)/ketik/KetikClient.tsx`
- `app/(main)/ketik/components/ChatInterface.tsx`
- `app/(main)/ketik/services/timeoutContext.ts`
- `app/(main)/ketik/services/geminiService.ts`
- `app/(main)/dashboard/monitoring/MonitoringClient.tsx`
- `app/(main)/dashboard/monitoring/monitoringData.ts`
