# PDKT Email Composer Refresh v1

## Ringkasan

Refresh tampilan workspace email PDKT agar mendekati referensi email modern tanpa merusak shell, flow, dan business logic yang sudah ada. v1 fokus pada perubahan UI di screen email aktif: email masuk utama ditampilkan sebagai detail view yang rapi, sedangkan area balas memakai composer-style panel yang lebih dekat ke referensi sebelumnya. Semua perubahan tetap berada di dalam overlay dan container PDKT saat ini.

## Perubahan Utama

- Pertahankan struktur induk existing di `app/(main)/pdkt/PdktClient.tsx`:
  - view `home` dan `email` tetap sama
  - overlay `fixed inset-0` tetap sama
  - container `max-w-5xl` dan `md:max-h-[92vh]` tetap sama
- Fokus implementasi di `app/(main)/pdkt/components/EmailInterface.tsx` sebagai reskin UI, bukan rewrite flow.
- Ubah email inbound utama dari bubble/thread besar menjadi `detail view` yang mengikuti pola referensi:
  - top bar ringkas dengan tombol kembali, judul halaman, dan aksi overflow atau status ringan
  - subject sebagai heading utama
  - blok metadata pengirim berisi `From`, `To`, `Cc`, dan timestamp
  - body email tampil sebagai konten baca utama
  - attachment tampil sebagai daftar file atau preview yang lebih datar dan rapi
  - action row di bawah email masuk untuk affordance `Reply`
- Ubah area balas email agar mengikuti composer-style panel:
  - field `To`, `Cc`, dan `Subject` tampil seperti composer email
  - field tersebut bersifat read-only dan mengambil nilai dari data sesi, tidak mengubah payload submit
  - textarea balasan menjadi area compose utama
  - tombol kirim tetap memakai flow existing `onSendReply(text)`
- Selaraskan visual riwayat email lain dalam sesi agar tetap konsisten dengan detail view baru:
  - kurangi treatment bubble yang terlalu tebal
  - pertahankan informasi pengirim, subject, waktu, isi, dan attachment
  - jangan ubah urutan history atau logika render data
- Pertahankan surface evaluasi async yang sudah ada:
  - state `processing`, `failed`, dan `completed` tetap muncul
  - panel evaluasi hanya diselaraskan visualnya agar tidak bentrok dengan composer-first layout

## Perubahan Interface dan Perilaku

- Tidak ada perubahan API, schema, atau payload backend.
- `handleSendReply(text)` tetap menerima body text saja.
- `To`, `Cc`, dan `Subject` pada composer tidak editable secara bisnis di v1.
- `EmailMessage`, `SessionConfig`, `SessionHistory`, route evaluasi, dan penyimpanan history tidak berubah.
- Jangan menampilkan aksi yang terlihat aktif bila belum benar-benar didukung backend:
  - `Reply` boleh aktif karena sudah ada flow balas
  - `Reply All`, `Forward`, format rich text, atau attachment compose tidak perlu dibuat aktif jika belum didukung
- Avatar pengirim pada detail view bersifat opsional:
  - jika data avatar tidak tersedia, gunakan fallback inisial atau placeholder visual yang konsisten dengan modul

## Detail Tampilan

- Email masuk utama mengikuti struktur referensi `Email Details`, bukan bubble chat:
  - subject di atas
  - metadata pengirim dan penerima di bawah subject
  - body sebagai blok baca tunggal
  - attachment dan action row setelah body
- Area compose mengikuti struktur referensi `Compose Email`, tetapi disesuaikan dengan flow PDKT:
  - top bar dan field rows lebih ringkas
  - composer menempel natural di dalam workspace PDKT yang sudah ada
  - tidak mengubah posisi overlay, tidak memecah layout menjadi route baru
- Semua styling tetap memakai token dan semantic class yang sudah ada:
  - `module-clean-app`
  - `module-clean-shell`
  - `module-clean-panel`
  - `module-clean-toolbar`
  - bila perlu tambahkan utility class kecil di `app/globals.css`, tetapi hindari hardcode tema baru dan hindari efek global ke modul lain

## Pengujian

- `npm run lint`
- `npm run build` atau `npm run type-check`

- Smoke test manual:
  - mulai sesi PDKT baru dan pastikan screen email tetap terbuka di overlay existing
  - email masuk pertama tampil sebagai detail view, bukan bubble besar
  - metadata `From/To/Cc/Subject` tampil benar dari session data
  - subject panjang dan email address panjang tidak merusak layout
  - attachment tetap bisa ditampilkan atau dibuka
  - klik balas membuka composer-style panel yang baru
  - kirim balasan tetap menyimpan history dan memicu evaluasi seperti flow existing
  - state `processing`, `failed`, dan `completed` tetap tampil aman
  - buka riwayat sesi lama dan pastikan tampilan baru tetap render tanpa error
  - cek mobile width agar header, metadata, dan composer tidak overflow

## Asumsi

- v1 adalah refresh UI scoped ke PDKT email workspace, bukan redesign total modul PDKT.
- Fokus utamanya adalah composer-first visual refresh dengan inbound detail view yang mendekati referensi.
- Layout induk, settings modal, history modal, logic evaluasi, dan penyimpanan history tetap dipertahankan.
- Jika ada aksi visual pada referensi yang belum didukung sistem saat ini, aksi itu tidak diaktifkan di v1.

## Addon: Subject Realism Hardening

Addon ini menambahkan guardrail realism untuk `subject` email konsumen awal agar simulasi tidak membocorkan inti masalah terlalu cepat. Tujuannya adalah menjaga kualitas latihan agen: konteks utama tetap harus dibaca dari body email, bukan disimpulkan hanya dari subject.

### Prinsip Utama

- Gunakan baseline `adaptive mix` untuk subject email awal:
  - sebagian sesi boleh memakai subject kosong
  - sebagian sesi boleh memakai subject sangat umum
  - sebagian sesi boleh memakai subject dengan clue tipis, tetapi tidak eksplisit
- Subject tidak boleh menjadi ringkasan diagnosis kasus.
- Body email tetap menjadi sumber informasi utama untuk memahami masalah konsumen.

### Perubahan Perilaku

- Ubah generation contract di `app/(main)/pdkt/services/geminiService.ts` agar AI tidak lagi didorong membuat subject yang “menarik/emosional”.
- Subject email awal boleh berupa string kosong jika itu lebih sesuai dengan karakter konsumen.
- Jika subject diisi, subject harus:
  - singkat
  - natural
  - samar
  - tidak mengungkap inti masalah secara langsung
- Hindari subject yang secara eksplisit menyebut kombinasi nama LJK + jenis masalah utama + hasil yang diinginkan konsumen.
- Fallback subject generik yang terlalu informatif seperti `Keluhan Pelanggan` tidak lagi menjadi default data utama; empty subject adalah state valid.

### Aturan Realism Subject

- Konsumen yang awam, bingung, panik, atau tidak terbiasa menulis email boleh mengirim email tanpa subject.
- Konsumen yang cukup terstruktur boleh memakai subject pendek seperti permintaan bantuan umum, tetapi tetap tidak terlalu menjelaskan kasus.
- Subject tidak boleh terasa “dioptimalkan” untuk membantu agen menjawab.
- Subject tidak boleh lebih informatif daripada paragraf pembuka body email.

### Dampak ke UI dan Flow

- `EmailMessage.subject` tetap dipertahankan sebagai string, tetapi empty string harus dianggap valid di seluruh render path.
- Pada detail view, composer, dan history, subject kosong harus dirender aman dengan placeholder netral seperti `Tanpa Subjek` atau treatment visual muted yang setara.
- Balasan agen tidak boleh menciptakan subject baru yang lebih informatif dari email awal jika subject inbound kosong atau sangat samar.
- Perubahan ini tidak mengubah payload submit balasan, evaluasi, atau penyimpanan history selain memperbolehkan subject kosong.

### Tambahan Pengujian

- Mulai beberapa sesi baru dan pastikan hasil subject bervariasi:
  - kosong
  - umum
  - sedikit memberi clue
- Pastikan subject tidak pernah langsung membocorkan inti masalah atau diagnosa kasus.
- Pastikan UI tetap stabil saat subject kosong pada:
  - detail view email aktif
  - composer field `Subject`
  - riwayat sesi
- Pastikan reply flow tetap aman bila subject inbound kosong.
