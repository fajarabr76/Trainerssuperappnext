# QA Analyzer Reporting Guidelines — Path to Zero

Dokumen ini adalah rujukan standar untuk AI dalam menghasilkan laporan kualitas di modul SIDAK (QA Analyzer). AI harus menginterpretasikan data secara dinamis mengikuti prinsip-prinsip di bawah ini.

---

## 🎯 Filosofi Utama: Path to Zero
Laporan ini tidak hanya menilai skor akhir, tetapi melacak perjalanan setiap parameter QA menuju angka nol temuan (**Zero Defect**).

- **Fokus Parameter**: Setiap parameter (misal: Verifikasi Data, Empati) dianggap memiliki "nyawa" dan trennya sendiri.
- **Audit Penuh (Full Audit)**: Data yang diolah adalah 100% sampel audit (bukan sampling), sehingga angka temuan adalah absolut dan nyata.
- **Arah Pergerakan (Directional)**: Fokus pada apakah angka temuan:
    - ↓ **Mendekati Zero**: Perbaikan (Improving).
    - ↑ **Menjauhi Zero**: Pemburukan (Worsening).
    - → **Stagnan**: Tidak ada perubahan volume temuan.
- **Alarm Regresi (⚠️ Regression Alert)**: Parameter yang pada periode sebelumnya sudah mencapai Zero, namun pada periode ini muncul temuan baru. Ini adalah prioritas utama untuk dicegah agar tidak menjadi kebiasaan buruk baru.

---

## 🤖 Instruksi untuk AI (Adaptabilitas Data)
AI **DIBERIKAN WEWENANG** untuk memodifikasi laporan berdasarkan kondisi data aktual:
1. **Identifikasi Peristiwa Eksternal**: Jika ada lonjakan temuan pada parameter tertentu (misal: Penguasaan Produk) yang bertepatan dengan peluncuran produk baru, AI harus menyebutkan korelasi ini.
2. **Cluster Temuan**: Jika temuan menumpuk di tim atau kelompok agen tertentu, AI harus melakukan segmentasi otomatis.
3. **Sustained Mastery**: Jika parameter tertentu sudah Zero selama >3 periode, AI bisa menghilangkannya dari detail analisis dan memindahkannya ke kategori "Sustained Mastery" untuk menghemat ruang laporan.

---

## 📘 FORMAT 1: Laporan Kualitas Layanan (Service Report)
**Target**: Management & Executive.
**Tujuan**: Monitoring strategi makro.

### 1. Ringkasan Eksekutif
- Visualisasi status (🟢/🟡/🔴) berdasarkan volume temuan.
- Highlight parameter yang "Memburuk" vs "Membaik" secara signifikan.

### 2. Path to Zero Tracker (Dashboard Arah)
Tabel perbandingan per periode yang menunjukkan:
- `Temuan Sekarang` vs `Temuan Lalu`.
- `Selisih (Δ)` dan `Arah (Direction Icon: ↓ ↑ →)`.
- `Status Path to Zero` (Mendekati/Menjauhi/Stagnan).

### 3. Analisis Deep-Dive
- **Zoom-in Worsening**: Analisis penyebab kenaikan temuan pada parameter tertentu.
- **Success Spotlight**: Analisis mengapa parameter tertentu bisa membaik (apa strategi yang berhasil?).
- **Pareto Analisis**: Menunjukkan 2-3 parameter penyumbang 80% defect.

### 4. Rekomendasi Strategis
- Rekomendasi tingkat sistem (Training, Update SOP, Perbaikan Produk, Update Tooling).

---

## 📗 FORMAT 2: Laporan Kinerja Individu (Individual Report)
**Target**: Team Leader & Agen.
**Tujuan**: Coaching & Personal Development.

### 1. Status Path to Zero Personal
- Ringkasan jumlah parameter yang sudah mencapai Zero vs total parameter.
- **Alarm Regresi ⚠️**: Menyorot parameter yang kembali "kotor" setelah sempat Zero.

### 2. Peta Parameter Personal
Tabel arah pergerakan parameter khusus milik agen tersebut.
- Tandai sebagai `ZERO Dipertahankan` jika konsisten 0.
- Tandai sebagai `Baru Capai ZERO` sebagai bentuk apresiasi.

### 3. Detail Bukti (Evidence)
- Daftar ID Tiket dan rekaman temuan konkret.
- Catatan auditor/QA untuk setiap temuan agar bisa didiskusikan saat coaching.

### 4. Personal Development Plan (PDP)
- Langkah taktis yang harus dilakukan agen (misal: Role-play, baca modul, self-review).

---

## 📊 Klasifikasi Temuan (Severity)
Meskipun fokus pada parameter, setiap temuan tetap memiliki kategori keparahan:
- **Critical**: Kesalahan fatal yang berdampak langsung pada operasional atau kepuasan pelanggan utama.
- **Non-Critical**: Kesalahan minor atau administratif.
*Catatan: Parameter yang menyentuh ranah sistem/system error tidak dihitung sebagai defect pekerjaan.*

---

## 💾 Standar Penamaan File (Naming Convention)
Setiap file yang dihasilkan harus memiliki nama yang manusiawi (human-readable) agar mudah dicari:
- **Laporan Layanan**: `Laporan_QA_Layanan_[Service]_[Periode].docx`
  - Contoh: `Laporan_QA_Layanan_Call_Januari-Maret_2026.docx`
- **Laporan Individu**: `Laporan_QA_Individu_[NamaAgent]_[Periode].docx`
  - Contoh: `Laporan_QA_Individu_Budi_Santoso_Januari-Maret_2026.docx`

*Catatan: Spasi harus diganti dengan underscore (_) dan karakter khusus lainnya harus dibersihkan.*
