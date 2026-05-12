# Requirements Document

## Pendahuluan

Dokumen ini mendefinisikan kebutuhan untuk perbaikan UI/UX modul PDKT (Paham Dulu Kasih Tanggapan) — sebuah tool simulasi email training. Perbaikan mencakup dua area utama: (1) memperbaiki gambar skenario yang pecah/pixelated, dan (2) meningkatkan kualitas visual workspace mailbox agar lebih bersih, profesional, dan mudah dibaca.

## Glossary

- **Modul_PDKT**: Modul simulasi email training yang memungkinkan user berlatih merespons email konsumen
- **Mailbox_Workspace**: Tampilan utama workspace yang terdiri dari sidebar daftar email dan detail pane
- **Sidebar_Email**: Panel kiri yang menampilkan daftar email masuk dengan preview singkat
- **Detail_Pane**: Panel kanan yang menampilkan isi lengkap email yang dipilih
- **Scenario_Image**: Gambar lampiran yang disimpan sebagai base64 string dalam data skenario
- **Settings_Modal**: Modal pengaturan untuk mengelola skenario, karakter, dan konfigurasi sistem
- **Image_Viewer**: Komponen modal untuk menampilkan gambar dalam ukuran penuh (zoom)
- **Typography_Hierarchy**: Sistem hierarki tipografi yang mengatur ukuran, berat, dan spacing teks

## Requirements

### Requirement 1: Perbaikan Rendering Gambar Skenario

**User Story:** Sebagai user, saya ingin gambar lampiran skenario ditampilkan dengan jelas tanpa pecah atau pixelated, sehingga saya dapat melihat detail gambar dengan baik.

#### Acceptance Criteria

1. WHEN gambar lampiran ditampilkan di Detail_Pane, THE Modul_PDKT SHALL merender gambar dengan aspect ratio asli tanpa cropping paksa yang menyebabkan distorsi
2. WHEN gambar lampiran ditampilkan di Detail_Pane, THE Modul_PDKT SHALL menggunakan MIME type yang sesuai dengan format asli gambar (png, jpeg, webp) berdasarkan header base64 data URI
3. WHEN gambar lampiran ditampilkan di Settings_Modal sebagai thumbnail, THE Modul_PDKT SHALL merender preview yang proporsional tanpa distorsi aspect ratio
4. WHEN user mengklik gambar lampiran, THE Image_Viewer SHALL menampilkan gambar dalam resolusi penuh dengan mode `object-contain` agar seluruh gambar terlihat
5. IF gambar base64 tidak memiliki prefix MIME type yang valid, THEN THE Modul_PDKT SHALL mendeteksi format dari header bytes dan menambahkan prefix yang sesuai

### Requirement 2: Penyederhanaan Typography Hierarchy

**User Story:** Sebagai user, saya ingin teks di workspace mudah dibaca dengan hierarki yang jelas, sehingga saya dapat fokus pada konten email tanpa gangguan visual.

#### Acceptance Criteria

1. THE Mailbox_Workspace SHALL menggunakan maksimal 3 level font-weight (regular, medium, semibold) untuk body text dan label
2. THE Mailbox_Workspace SHALL menghindari penggunaan `font-black` dan `uppercase tracking-widest` pada label non-header
3. WHEN menampilkan label status dan metadata, THE Sidebar_Email SHALL menggunakan font-weight medium dengan letter-spacing normal
4. WHEN menampilkan judul email, THE Detail_Pane SHALL menggunakan font-weight semibold dengan ukuran yang proporsional terhadap viewport

### Requirement 3: Perbaikan Layout Sidebar Email

**User Story:** Sebagai user, saya ingin daftar email di sidebar terlihat rapi dan tidak terlalu padat secara visual, sehingga saya dapat dengan cepat memindai dan memilih email.

#### Acceptance Criteria

1. WHEN menampilkan item email di sidebar, THE Sidebar_Email SHALL menggunakan padding yang konsisten dan spacing yang cukup antar elemen
2. WHEN menampilkan status badge pada item email, THE Sidebar_Email SHALL menggunakan indikator visual yang subtle (dot indicator atau teks ringan) tanpa background warna yang mencolok
3. WHEN item email dipilih (selected), THE Sidebar_Email SHALL menandai item dengan highlight yang halus menggunakan border-left accent tanpa mengubah ukuran atau layout item lain
4. THE Sidebar_Email SHALL menampilkan sender name, subject, snippet, dan timestamp dengan hierarki visual yang jelas menggunakan ukuran font dan opacity yang berbeda

### Requirement 4: Perbaikan Detail Pane Readability

**User Story:** Sebagai user, saya ingin konten email di detail pane mudah dibaca dengan spacing yang nyaman, sehingga saya dapat memahami isi email dengan baik.

#### Acceptance Criteria

1. WHEN menampilkan body email, THE Detail_Pane SHALL menggunakan line-height minimal 1.6 dan max-width yang membatasi panjang baris agar nyaman dibaca
2. WHEN menampilkan metadata pengirim (nama, email, tanggal), THE Detail_Pane SHALL mengelompokkan informasi dengan spacing yang jelas antara metadata dan body email
3. WHEN menampilkan hasil evaluasi, THE Detail_Pane SHALL menggunakan card layout dengan border subtle dan spacing internal yang konsisten
4. WHEN menampilkan lampiran gambar, THE Detail_Pane SHALL menggunakan grid layout responsif dengan gap yang cukup dan rounded corners yang konsisten

### Requirement 5: Pengurangan Visual Noise

**User Story:** Sebagai user, saya ingin interface workspace terlihat bersih dan profesional tanpa elemen dekoratif berlebihan, sehingga saya dapat fokus pada tugas simulasi email.

#### Acceptance Criteria

1. THE Mailbox_Workspace SHALL menghindari penggunaan gradient overlay, shadow berlebihan (lebih dari `shadow-md`), dan animasi yang tidak fungsional
2. THE Mailbox_Workspace SHALL menggunakan border dan separator yang subtle (opacity rendah) untuk memisahkan section
3. WHEN menampilkan tombol aksi utama (Balas, Buat Email), THE Modul_PDKT SHALL menggunakan satu level emphasis (solid background) tanpa shadow glow atau efek tambahan
4. THE Settings_Modal SHALL menggunakan layout yang lebih compact dengan spacing yang proporsional tanpa rounded corners berlebihan (maksimal `rounded-xl`)

### Requirement 6: Konsistensi Tampilan Gambar di Semua View

**User Story:** Sebagai user, saya ingin gambar ditampilkan secara konsisten di semua bagian modul (detail pane, settings modal, email interface), sehingga pengalaman visual saya seragam.

#### Acceptance Criteria

1. THE Modul_PDKT SHALL menggunakan komponen Image yang sama (shared component) untuk merender gambar lampiran di Detail_Pane, Settings_Modal, dan EmailInterface
2. WHEN gambar ditampilkan sebagai thumbnail (di Settings_Modal), THE Modul_PDKT SHALL menggunakan ukuran minimum 80x80px dengan `object-contain` dan background placeholder
3. WHEN gambar ditampilkan dalam grid (di Detail_Pane dan EmailInterface), THE Modul_PDKT SHALL menggunakan aspect ratio 4:3 dengan `object-contain` dan background netral
4. WHEN gambar di-zoom (fullscreen), THE Image_Viewer SHALL menampilkan gambar dengan resolusi asli, `object-contain`, dan background gelap semi-transparan
