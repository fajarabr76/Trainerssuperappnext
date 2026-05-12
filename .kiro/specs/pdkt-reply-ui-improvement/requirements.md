# Requirements Document

## Pendahuluan

Dokumen ini mendefinisikan kebutuhan untuk perbaikan UI/UX pada form reply ("Balas") di modul PDKT. Modul PDKT adalah simulator pelatihan email yang memiliki dua tempat di mana form reply muncul: `EmailInterface.tsx` (single-session flow) dan `EmailComposer.tsx` (mailbox flow). Kedua komponen saat ini memiliki tampilan yang terlalu minimalis, kurang memiliki pemisahan visual yang jelas dari konten email, dan tidak memberikan pengalaman seperti email client profesional.

## Glossary

- **Reply_Composer**: Komponen form balasan email yang muncul saat pengguna mengklik tombol "Balas", mencakup header, field penerima, textarea, dan tombol kirim
- **EmailInterface**: Komponen tampilan email untuk single-session flow yang memiliki inline reply composer
- **EmailComposer**: Komponen standalone reply composer yang digunakan dalam MailboxInterface
- **Visual_Separator**: Elemen visual (border, shadow, spacing, atau background) yang membedakan area reply dari konten email di atasnya
- **Composer_Container**: Wrapper/card yang membungkus seluruh form reply dengan background dan border yang jelas
- **Field_Section**: Area yang menampilkan informasi Kepada, Cc, dan Subjek dalam form reply
- **Module_PDKT_Theme**: Tema warna ungu (purple) yang digunakan sebagai identitas visual modul PDKT

## Requirements

### Requirement 1: Pemisahan Visual antara Konten Email dan Form Reply

**User Story:** Sebagai peserta pelatihan, saya ingin form reply terpisah secara visual dari konten email di atasnya, sehingga saya dapat dengan jelas membedakan area baca email dan area menulis balasan.

#### Acceptance Criteria

1. WHEN Reply_Composer ditampilkan, THE Visual_Separator SHALL menampilkan garis pembatas dengan ketebalan minimal 1px dan warna yang kontras terhadap background
2. WHEN Reply_Composer ditampilkan, THE Composer_Container SHALL memiliki background color yang berbeda dari area konten email di atasnya
3. WHEN Reply_Composer ditampilkan, THE Composer_Container SHALL memiliki shadow subtle (elevation) untuk memberikan kesan "terangkat" dari konten email
4. WHEN Reply_Composer ditampilkan, THE Visual_Separator SHALL menyertakan spacing minimal 12px antara konten email terakhir dan tepi atas form reply

### Requirement 2: Header Reply Composer yang Informatif

**User Story:** Sebagai peserta pelatihan, saya ingin header form reply memberikan konteks yang jelas bahwa saya sedang membalas email, sehingga saya tidak bingung dengan area yang sedang aktif.

#### Acceptance Criteria

1. WHEN Reply_Composer ditampilkan, THE Reply_Composer SHALL menampilkan ikon reply (panah balas) di samping label "Balas" pada header
2. WHEN Reply_Composer ditampilkan, THE Reply_Composer SHALL menampilkan label header dengan ukuran font minimal 12px dan font-weight semi-bold
3. WHEN Reply_Composer ditampilkan, THE Reply_Composer SHALL menampilkan indikator warna Module_PDKT_Theme pada header sebagai aksen visual
4. WHEN Reply_Composer ditampilkan, THE Reply_Composer SHALL menampilkan tombol close (X) yang memiliki area klik minimal 32x32px untuk aksesibilitas

### Requirement 3: Layout Field Penerima yang Terstruktur

**User Story:** Sebagai peserta pelatihan, saya ingin field Kepada, Cc, dan Subjek ditampilkan dengan layout yang rapi dan mudah dibaca, sehingga saya dapat memverifikasi informasi penerima dengan cepat.

#### Acceptance Criteria

1. THE Field_Section SHALL menampilkan label field (Kepada, Cc, Subjek) dengan ukuran font minimal 12px dan warna yang cukup kontras untuk keterbacaan
2. THE Field_Section SHALL memiliki padding vertikal minimal 8px antar baris field untuk mencegah tampilan yang terlalu rapat
3. THE Field_Section SHALL menampilkan nilai field dengan ukuran font minimal 13px agar mudah dibaca
4. THE Field_Section SHALL memiliki border-bottom sebagai pemisah antara area field dan textarea
5. WHEN nilai field kosong, THE Field_Section SHALL menampilkan placeholder text dengan style yang berbeda dari nilai aktual (opacity lebih rendah)

### Requirement 4: Textarea dengan Batas Visual yang Jelas

**User Story:** Sebagai peserta pelatihan, saya ingin area penulisan balasan memiliki batas yang jelas dan cukup luas, sehingga saya merasa nyaman menulis balasan tanpa kebingungan tentang area input.

#### Acceptance Criteria

1. THE Reply_Composer SHALL menampilkan textarea dengan background color yang sedikit berbeda dari Composer_Container untuk menandai area input
2. THE Reply_Composer SHALL menampilkan textarea dengan tinggi minimal 160px pada desktop dan 128px pada mobile
3. THE Reply_Composer SHALL menampilkan textarea dengan padding internal minimal 16px untuk kenyamanan penulisan
4. THE Reply_Composer SHALL menampilkan placeholder text "Tulis balasan Anda..." dengan warna yang subtle namun tetap terlihat
5. WHEN textarea mendapat fokus, THE Reply_Composer SHALL memberikan visual feedback berupa perubahan border atau outline yang subtle

### Requirement 5: Konsistensi Visual antara EmailInterface dan EmailComposer

**User Story:** Sebagai peserta pelatihan, saya ingin tampilan form reply konsisten di semua tempat dalam modul PDKT, sehingga pengalaman saya tidak membingungkan saat berpindah antara mode single-session dan mailbox.

#### Acceptance Criteria

1. THE EmailInterface reply composer dan THE EmailComposer SHALL menggunakan struktur HTML dan class styling yang identik untuk header, field section, textarea, dan tombol kirim
2. THE EmailInterface reply composer dan THE EmailComposer SHALL menggunakan spacing, font-size, dan color scheme yang sama
3. THE EmailInterface reply composer dan THE EmailComposer SHALL menggunakan animasi slide-up dengan parameter yang identik (spring damping: 25, stiffness: 200)

### Requirement 6: Responsivitas Mobile

**User Story:** Sebagai peserta pelatihan yang menggunakan perangkat mobile, saya ingin form reply tetap nyaman digunakan pada layar kecil, sehingga saya dapat menyelesaikan latihan dari perangkat apapun.

#### Acceptance Criteria

1. WHILE viewport width kurang dari 768px, THE Reply_Composer SHALL menyesuaikan padding horizontal menjadi 16px
2. WHILE viewport width kurang dari 768px, THE Reply_Composer SHALL menampilkan textarea dengan tinggi minimal 128px
3. WHILE viewport width 768px atau lebih, THE Reply_Composer SHALL menampilkan textarea dengan tinggi minimal 192px
4. THE Reply_Composer SHALL memastikan tombol kirim tetap terlihat dan mudah dijangkau pada semua ukuran layar tanpa perlu scroll

### Requirement 7: Animasi dan Transisi

**User Story:** Sebagai peserta pelatihan, saya ingin form reply muncul dengan animasi yang halus dan profesional, sehingga transisi antara membaca dan membalas email terasa natural.

#### Acceptance Criteria

1. WHEN pengguna mengklik tombol "Balas", THE Reply_Composer SHALL muncul dengan animasi slide-up dari bawah menggunakan spring animation (damping: 25, stiffness: 200)
2. WHEN pengguna menutup form reply, THE Reply_Composer SHALL menghilang dengan animasi slide-down ke bawah menggunakan parameter yang sama
3. WHEN Reply_Composer selesai animasi masuk, THE Reply_Composer SHALL memberikan fokus otomatis pada textarea

### Requirement 8: Tombol Kirim yang Jelas

**User Story:** Sebagai peserta pelatihan, saya ingin tombol kirim balasan terlihat jelas dan memberikan feedback saat proses pengiriman, sehingga saya tahu kapan balasan saya sedang diproses.

#### Acceptance Criteria

1. THE Reply_Composer SHALL menampilkan tombol kirim dengan warna Module_PDKT_Theme dan teks yang kontras (putih)
2. THE Reply_Composer SHALL menampilkan tombol kirim dengan padding yang cukup (minimal horizontal 20px, vertikal 10px) dan border-radius untuk tampilan modern
3. WHEN textarea kosong atau hanya berisi whitespace, THE Reply_Composer SHALL menonaktifkan tombol kirim dengan opacity yang berkurang dan cursor not-allowed
4. WHILE proses pengiriman berlangsung, THE Reply_Composer SHALL menampilkan loading indicator (spinner) pada tombol kirim dan menonaktifkan interaksi
5. WHILE proses pengiriman berlangsung, THE Reply_Composer SHALL mengubah teks tombol menjadi "Mengirim..." sebagai feedback visual
