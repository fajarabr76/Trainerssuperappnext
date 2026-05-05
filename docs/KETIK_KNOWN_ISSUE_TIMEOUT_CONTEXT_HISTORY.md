# KETIK Known Issue — Timeout, Context Drift, and Monitoring History Gaps

## Status

- Status: `resolved`
- Prioritas: `high`
- Dampak: sesi KETIK bisa tetap menerima balasan setelah timer habis, transcript paragraf kehilangan line break, konsumen keluar dari konteks skenario, history baru tidak selalu tampil konsisten di monitoring setelah reload, **narasi gambar `[SISTEM]` + `[SEND_IMAGE]` bocor ke bubble konsumen, konsumen tidak merespons greeting pertama lalu langsung menutup sesi**.

## Route Terdampak

- `/ketik`
- `/dashboard/monitoring`

## Gejala

1. Saat timer 5/10/15 menit habis, konsumen kadang masih membalas pesan agent alih-alih menutup percakapan secara natural.
2. Pesan agent atau konsumen yang berisi beberapa paragraf tampil sebagai satu blok panjang di simulasi chat dan transcript monitoring.
3. Konsumen kadang membahas topik baru yang tidak ada di skenario, misalnya menambah isu cetak SLIK ketika kasus awal hanya tentang penipuan.
4. Beberapa sesi KETIK selesai tersimpan di flow pengguna, tetapi tidak langsung terbaca konsisten di monitoring setelah halaman dimuat ulang.
5. Saat konsumen AI mengirim gambar, teks narasi internal seperti `[SISTEM] Konsumen mengirim tangkapan layar pesan penipuan yang diterima [SEND_IMAGE: 0]` tampil sebagai bubble teks yang terlihat oleh pengguna agen.
6. Konsumen AI tidak merespons greeting pertama agen, lalu muncul setelah >3 menit dan langsung menutup sesi tanpa pernah menyampaikan masalah inti.

## Akar Masalah Final

1. **Timeout lifecycle di client belum benar-benar terminal** — request AI biasa yang sudah in-flight masih bisa selesai setelah timer habis dan menjadwalkan balasan baru bila hasilnya tidak dibuang.
2. **Rendering transcript belum mempertahankan newline** — bubble chat dan modal transcript memakai render teks biasa sehingga `\n` diratakan menjadi satu paragraf.
3. **Guardrail skenario kurang tegas** — prompt konsumen belum cukup eksplisit membatasi fakta/topik hanya pada inti skenario dan pertanyaan agent yang relevan.
4. **Save path sesi terlalu bergantung pada client flow** — penyimpanan sesi dilakukan dari client-side insert, sehingga alur persistence, warning handling, dan cache refresh monitoring tidak terkonsolidasi.
5. **Prompt AI menginstruksikan narasi `[SISTEM]` + `[SEND_IMAGE]` dalam satu part** — aturan #4 lama mengarahkan AI untuk menulis `[SISTEM] Mengirim bukti transfer [SEND_IMAGE: 0]`, dan normalizer tidak menangani kasus di mana kedua tag berada di part yang sama sehingga teks narasi ikut masuk ke bubble konsumen.
6. **Pending timeout tidak dibatalkan saat send baru** — saat agen mengirim greeting kedua sementara respons konsumen dari greeting pertama masih dalam delay pacing, `clearPendingTimeouts()` tidak dipanggil sehingga respons lama tetap muncul dan bisa bertabrakan dengan respons baru. Ditambah konsumen AI tidak diwajibkan merespons dengan penjelasan masalah di pesan-pesan awal.

## Fix Yang Diterapkan

### 1. Session lifecycle dibuat eksplisit dan terminal

- `ChatInterface.tsx` memakai `SessionPhase = 'active' | 'expired' | 'closed'`.
- Semua `setTimeout` balasan bertahap disimpan di `pendingTimeoutsRef` dan dibersihkan lewat `clearPendingTimeouts()` saat sesi berakhir atau komponen unmount.
- Saat `timeLeft` mencapai `0`, timeout finalization dieksekusi sekali: sesi dipindah ke `expired`, satu pesan penutup konsumen dihasilkan via prompt timeout khusus, lalu semua jalur balasan konsumen berikutnya dihentikan.
- Ditambahkan `sessionPhaseRef` untuk membuang hasil request AI biasa yang selesai setelah sesi tidak lagi `active`, sehingga race condition pasca-timeout tidak memunculkan balasan konsumen baru.

### 1a. Timeout close final dan immutable

- `handleSessionTimeout()` SEKARANG SYNCHRONOUS — tidak lagi memanggil `generateConsumerResponse()` async untuk timeout.
- Guard tripel memastikan timeout close hanya dieksekusi satu kali: `sessionPhaseRef !== 'active'`, `timeoutFinalizedRef`, dan `closingMessageSentRef`.
- Saat timeout terjadi, satu pesan fallback statis langsung di-append dan bersifat **final**: `"Maaf, saya harus lanjut aktivitas dulu. Nanti saya hubungi lagi ya. Terima kasih."`
- Teks fallback TIDAK PERNAH di-overwrite, di-upgrade in-place, atau di-generate ulang — immutable setelah tampil.
- Tidak ada lagi async AI generation untuk timeout — menghilangkan race condition dan pesan berubah sendiri setelah tampil.

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

### 1e. Helper button composer dibuat session-scoped dua fase

- Pada awal sesi, helper button tampil sebagai `Gunakan Template Salam`.
- Setelah user pernah klik template salam lalu mengirim pesan agent pertama, helper button berubah ke `Gunakan Maintenance`.
- Mode `Gunakan Maintenance` bertahan sampai sesi diakhiri (`Selesai`) dan otomatis reset saat sesi baru dimulai.
- Tombol helper tetap terlihat pada fase `active` maupun `expired` untuk menjaga konsistensi alur akhir sesi.

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

### 4a. Read path history dibuat lebih tahan error

- Read history tetap `ketik_history` sebagai jalur utama.
- Jika query `ketik_history` gagal, client melakukan fallback ke `results` modul `ketik` (mapping dari `details`) agar riwayat tetap terbaca.
- Error log distandarkan menjadi warning terstruktur (`message/details/hint/code`) supaya investigasi tidak berhenti di payload kosong `{}`.

### 5. Auth gate di UI diperjelas

- `authReady` menahan tombol `Mulai Simulasi` sampai status autentikasi selesai dibaca.
- Tombol `Selesai` di chat juga nonaktif bila auth belum siap.
- Jika sesi tidak bisa disimpan karena auth belum siap atau persistence gagal, pengguna mendapat pesan error yang jelas.

### 6. Perbaikan rendering gambar — narasi `[SISTEM]` + `[SEND_IMAGE]` di-strip

- **Helper baru `stripNarrationFromImagePart()`** di `ChatInterface.tsx` — mengekstrak hanya tag `[SEND_IMAGE: N]` dari teks yang mengandung narasi deskriptif. Jika ada teks narasi di sekitar tag gambar, narasi tersebut dibuang dan hanya tag gambar yang disimpan. Saat narasi di-strip, `console.warn` terstruktur dicatat untuk pemantauan.
- **`normalizeGeneratedParts()`** — menambah intercept di awal loop: jika sebuah part mengandung `[SISTEM]` DAN `[SEND_IMAGE]` dalam satu string, strip narasi dan hanya simpan `[SEND_IMAGE: N]` sebagai `sender: 'consumer'`.
- **`normalizeMessagesForDisplay()`** — menambah intercept serupa: jika `sender='system'` dan teks mengandung `[SEND_IMAGE]`, strip narasi dan konversi ke `sender: 'consumer'`.
- **Renderer system message defensif** — jika bubble system mengandung tag gambar, `systemTextWithoutTag` di-set ke string kosong agar narasi tidak dirender, hanya gambar yang tampil.

### 7. Perbaikan AI prompt — gambar tanpa narasi

- **Aturan #4 di `geminiService.ts`** diubah — AI diinstruksikan untuk menulis HANYA `[SEND_IMAGE: indeks]` tanpa narasi deskriptif. Jika ingin memberi keterangan tentang gambar, tulis sebagai chat konsumen biasa di part terpisah setelah `[BREAK]`.
- **Aturan #3** diklarifikasi — tag `[SISTEM]` sekarang hanya untuk aksi fisik internal (misal: "Konsumen pergi mengambil dokumen") dan tidak boleh muncul bersama `[SEND_IMAGE]` dalam satu part.

### 8. Perbaikan pacing awal sesi

- **Band `greeting_reply` baru** di `responsePacing.ts` — respons pertama konsumen setelah greeting dipacing 2–6 detik (realistic) / 0.5–1.5 detik (training), menggantikan klasifikasi berbasis panjang teks yang bisa menghasilkan delay 10–20 detik.
- **Slow guard diperketat** — threshold `consumerTurnIndex` dinaikkan dari `< 3` ke `< 4`; ditambah time-based guard: slow tidak diizinkan jika `elapsedSeconds < 25% totalDurationSeconds`.
- **`SlowEligibilityParams`** diperluas dengan `elapsedSeconds?` dan `totalDurationSeconds?` (opsional, backward-compatible).
- **Deteksi greeting reply** di `handleSend()` — jika `consumerTurnCountRef.current === 0` (belum ada turn konsumen sebelumnya), `firstBand` di-override ke `'greeting_reply'` alih-alih hasil `classifyTextBand()`.

### 9. Perbaikan anti-penutupan dini

- **Aturan #13 di `geminiService.ts`** diperkuat — dalam 3–4 pesan pertama, konsumen WAJIB fokus menjelaskan masalah dan TIDAK BOLEH menutup percakapan. Greeting pertama HARUS dijawab dengan penjelasan masalah atau sapaan balik yang menyampaikan inti keluhan.
- **`buildTimeLimitInstruction()`** sesi masih panjang — ditambah instruksi "WAJIB menjelaskan masalah di 2–3 pesan pertama dan TIDAK BOLEH menutup percakapan sebelum inti masalah tersampaikan."

### 10. Proteksi terhadap double-send race condition

- **`clearPendingTimeouts()` di awal `handleSend()`** — setiap kali agen mengirim pesan baru, semua timeout respons konsumen yang masih pending di-cancel. Ini mencegah respons dari greeting pertama muncul setelah greeting kedua dikirim.
- **`sendGenerationRef` counter** — setiap panggilan `handleSend()` mendapat nomor generasi. Setelah AI response kembali, jika nomor generasi sudah berubah (ada send yang lebih baru), respons di-discard diam-diam. Ini mencegah respons AI kadaluarsa muncul saat agen mengirim pesan ganda dengan cepat.

## Interface yang Berubah

- `persistKetikSession(params)` mengembalikan `success`, `session`, `warning`, dan `error`.
- `ChatInterface` menerima prop `authReady?: boolean`.
- `ChatInterface` memakai state internal `SessionPhase`, `sessionPhaseRef`, `timeoutFinalizedRef`, dan `closingMessageSentRef` untuk menjaga timeout close tetap satu kali, idempotent, dan immutable.
- `PacingBand` type (di `responsePacing.ts` dan `types.ts`) diperluas dengan union `'greeting_reply'`.
- `SlowEligibilityParams` menerima `elapsedSeconds?: number` dan `totalDurationSeconds?: number` (opsional).
- `timeoutFinalizedRef`, `closingMessageSentRef`, dan `sendGenerationRef` di `ChatInterface` sebagai guard terhadap respons AI kadaluarsa dan overwrite pesan timeout.

## Regression Guard

- [ ] Setelah timeout habis, konsumen hanya boleh menutup sesi sekali dan tidak boleh mengirim balasan baru dari request lama yang selesai belakangan.
- [ ] Teks pesan penutup timeout bersifat immutable — tidak boleh berubah, di-overwrite, atau di-generate ulang setelah tampil di bubble konsumen.
- [ ] Input chat tetap tampil saat sesi `active` dan `expired`, tetapi balasan konsumen hanya boleh terjadi saat `active`.
- [ ] Helper button sesi harus mulai dari `Gunakan Template Salam`, lalu hanya berubah ke `Gunakan Maintenance` setelah template pernah diklik dan pesan agent pertama terkirim.
- [ ] Bubble chat dan transcript monitoring harus mempertahankan line break multiline.
- [ ] Konsumen tidak boleh memperkenalkan topik baru di luar inti skenario.
- [ ] `ketik_history` tetap menjadi primary read path untuk monitoring KETIK.
- [ ] Jika read `ketik_history` gagal, fallback read `results` modul `ketik` harus tetap menjaga sesi history bisa dibuka.
- [ ] Linkage `results.details.legacy_history_id` tetap ada untuk sinkronisasi delete dan traceability.
- [ ] Insert `results` yang gagal tidak boleh menggagalkan penyimpanan `ketik_history`.
- [ ] Perubahan baru di KETIK tidak boleh menghapus `revalidatePath('/dashboard/monitoring')`.
- [ ] Gambar yang dikirim konsumen TIDAK boleh menampilkan teks narasi seperti "Konsumen mengirim tangkapan layar" di bubble konsumen — hanya gambar dan/atau chat biasa yang boleh tampil.
- [ ] Respons pertama konsumen setelah greeting harus dipacing di band `greeting_reply` (2–6 detik realistic), bukan band `long` (10–20 detik).
- [ ] Slow pacing TIDAK boleh muncul pada 3 turn pertama konsumen dan TIDAK boleh muncul di 25% awal durasi sesi.
- [ ] Konsumen TIDAK boleh menutup percakapan di 3–4 pesan pertama atau merespons greeting pertama dengan pamit.
- [ ] Saat agen mengirim pesan baru, semua timeout respons konsumen yang masih pending harus di-cancel.
- [ ] Saat agen mengirim pesan ganda cepat, respons AI dari send lama tidak boleh muncul; hanya respons dari send terbaru yang diproses.

## Smoke Steps Singkat

1. Mulai sesi KETIK berdurasi pendek, kirim pesan tepat menjelang `0:00`, lalu pastikan setelah timer habis tidak ada balasan konsumen tambahan dari request lama.
2. Kirim pesan agent dengan beberapa paragraf dan verifikasi bubble chat tetap multiline.
3. Selesaikan sesi lalu buka detail transcript di monitoring; pastikan paragraf tetap utuh.
4. Jalankan skenario penipuan dan coba bawa percakapan ke topik lain; pastikan konsumen mengarahkan kembali ke inti skenario.
5. Uji timeout dengan pesan terakhir dari consumer, lalu pastikan closing tidak mengonfirmasi solusi yang tidak pernah diberikan agent.
6. Uji timeout dengan pesan terakhir dari agent yang jelas memberi arahan, lalu pastikan acknowledgement singkat masih natural sebelum penutupan.
7. Akhiri sesi KETIK, reload `/dashboard/monitoring`, lalu pastikan history baru muncul.
8. Saat timeout sudah terjadi, kirim 2-3 pesan agent tambahan dan pastikan tidak ada balasan konsumen baru.
9. Mulai sesi dengan skenario yang memiliki gambar, verifikasi bahwa saat konsumen mengirim gambar, hanya gambar yang muncul tanpa teks narasi "Konsumen mengirim tangkapan layar" atau sejenisnya.
10. Mulai sesi 5 menit, kirim greeting template, ukur delay sebelum balasan pertama konsumen — harus 2–6 detik di mode realistic (bukan 10–20 detik).
11. Mulai sesi dan kirim 1–2 pesan; konsumen TIDAK boleh langsung menutup percakapan atau memberi alasan harus pergi.
12. Mulai sesi 5 menit, kirim 3 pesan berturut-turut, pastikan slow pacing tidak muncul di ketiga pesan tersebut.
13. Kirim 2 pesan agent dengan cepat (double-send), pastikan hanya respons dari send terbaru yang muncul, tidak ada duplikasi atau overlap respons dari send pertama.

## Checklist Penutupan

- [ ] `npm run lint` pass.
- [ ] `npm run type-check` pass.
- [ ] `git diff --check` pass.
- [ ] Smoke manual timeout race pass.
- [ ] Smoke manual multiline transcript pass.
- [ ] Smoke manual monitoring reload pass.

## Referensi Silang

- `app/types.ts` — `PacingMeta` band union (termasuk `greeting_reply`)
- `app/(main)/ketik/actions.ts`
- `app/(main)/ketik/KetikClient.tsx`
- `app/(main)/ketik/components/ChatInterface.tsx` — normalizer gambar, send generation counter, greeting reply detection, clearPendingTimeouts di handleSend
- `app/(main)/ketik/services/responsePacing.ts` — band greeting_reply, slow guard diperketat, SlowEligibilityParams diperluas
- `app/(main)/ketik/services/geminiService.ts` — aturan #3/#4/#13 diperbarui, buildTimeLimitInstruction diperkuat
- `app/(main)/ketik/services/timeoutContext.ts`
- `app/(main)/dashboard/monitoring/MonitoringClient.tsx`
- `app/(main)/dashboard/monitoring/monitoringData.ts`
