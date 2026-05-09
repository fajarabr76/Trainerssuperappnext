# PDKT Durable Mailbox Guide

## Deskripsi
Modul PDKT (Paham Dulu Kasih Tanggapan) telah bertransformasi dari sistem sesi linear menjadi sistem **Persistent Manual Mailbox**. Perubahan ini bertujuan untuk memberikan pengalaman simulasi yang lebih realistis, di mana user dapat mengelola daftar email masuk (inbound) yang harus ditelaah dan dibalas secara manual.

## Arsitektur Data
Penyimpanan utama inbound email berada pada tabel `pdkt_mailbox_items`.

### Alur Data:
1. **Pemicuan (Creation)**: User memilih skenario secara manual.
    - Jika user adalah **Admin/Trainer**, email yang dihasilkan akan otomatis di-*fanout* (disalin) ke semua akun Leader dan Agent yang aktif dan disetujui.
    - Jika user adalah **Leader/Agent**, email hanya dibuat untuk akun mereka sendiri.
    - Idempotensi dijaga menggunakan `client_request_id` untuk mencegah duplikasi akibat double-click.
    - Batch fanout bersifat **strict**: jika terdeteksi duplikasi request (`Duplicate mailbox request`) atau terjadi kegagalan insert, transaksi dibatalkan tanpa menyisakan row parsial.
2. **Interaksi**: Email yang berstatus `open` tampil di sidebar mailbox. User dapat memilih email untuk melihat detail dan menulis balasan.
3. **Penyelesaian (Submission)**: Saat user mengirim balasan, sistem memanggil RPC `submit_pdkt_mailbox_reply`. 
    - Row baru di `pdkt_history` dibuat untuk menyimpan riwayat sesi dan memicu evaluasi.
    - Status item di `pdkt_mailbox_items` berubah menjadi `replied` dan `history_id` dihubungkan ke row riwayat tersebut.
4. **Evaluasi**: Hasil evaluasi AI diproses secara asinkron menggunakan helper internal `processPdktEvaluation`. UI melakukan polling status hingga selesai atau gagal.

## Shared Scenario Templates
Skenario sekarang mendukung **Sample Email Template**:
- **Subject & Body**: Penanggung jawab (Admin/Trainer) dapat menentukan draft email contoh untuk skenario tertentu.
- **Forced Mode (Selalu gunakan template ini)**: Jika aktif, sistem tidak akan memanggil AI untuk meng-*generate* email baru, melainkan langsung menggunakan teks template tersebut.
- **Substitusi Nama**: Jika menggunakan mode template, nama konsumen akan disisipkan secara determinis sesuai pengaturan `Consumer Name Placement` (Awal, Tengah, Akhir, atau Tidak Disebut).

## Tabel `pdkt_mailbox_items`
| Kolom | Tipe | Deskripsi |
|---|---|---|
| `id` | uuid | Primary Key |
| `user_id` | uuid | Owner item (RLS: own-user only) |
| `status` | text | `open`, `replied`, `deleted` |
| `created_by_user_id` | uuid | User yang memicu pembuatan email (Admin/Trainer) |
| `is_shared_copy` | boolean | `true` jika item ini hasil fanout ke akun agent/leader |
| `sender_name` | text | Nama pengirim (AI generated atau dari identitas) |
| `subject` | text | Subjek email |
| `inbound_email` | jsonb | Data lengkap email masuk pertama |
| `history_id` | uuid | Reference ke `pdkt_history` |
| `replied_at` | timestamptz | Timestamp saat balasan dikirim |

## Keandalan Evaluasi (Async Recovery)
Sistem evaluasi mendukung **Stale Recovery**:
- Jika proses evaluasi macet (> 5 menit), endpoint akan mengizinkan proses tersebut untuk di-*claim* ulang.
- User juga dapat memicu retry manual melalui tombol "Coba Lagi" pada UI jika evaluasi gagal.

## Usage Tracking Accuracy
Usage delta (`aktivitas terakhir`) dihitung secara presisi:
- **Create Email**: Baseline ditangkap tepat sebelum pemanggilan AI/Logic pembuatan email.
- **Submit Reply**: Baseline ditangkap tepat sebelum submission. Delta diperbarui lagi saat status evaluasi berubah menjadi terminal (`completed` atau `failed`).
Hal ini memastikan biaya yang ditampilkan mencerminkan dampak total dari satu aktivitas simulasi lengkap.

## Operasional Frontend
- **Filters**: Default ke `Belum Dibalas` agar user fokus pada tugas yang tersisa.
- **Search**: Pencarian real-time berdasarkan Nama Pengirim atau Subjek.
- **Persistence**: Keadaan mailbox tetap bertahan lintas sesi.
