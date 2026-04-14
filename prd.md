# Product Requirements Document
## Trainers SuperApp

| Field | Detail |
|---|---|
| Product | Trainers SuperApp |
| Status | Active internal application |
| Platform | Web app |
| Stack | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Supabase, Motion, Recharts |

## 1. Ringkasan Produk

Trainers SuperApp adalah platform internal untuk operasional contact center training. Aplikasi ini menggabungkan landing page, auth, dashboard, simulasi kerja, database peserta, monitoring, dan quality assurance dalam satu pengalaman yang konsisten.

Tujuan utamanya adalah membantu tim kerja bergerak cepat tanpa lompat-lompat antar sistem yang terasa terpisah.

## 2. Modul Aktif

### 2.1 Dashboard
Pusat kendali untuk melihat ringkasan performa, aktivitas terakhir, dan arah kerja harian.

### 2.2 KETIK
Simulasi chat untuk melatih komunikasi tertulis yang cepat dan tetap empatik.

### 2.3 PDKT
Workspace email untuk melatih korespondensi yang rapi dan profesional.

### 2.4 TELEFUN
Simulasi percakapan telepon untuk latihan komunikasi suara.

### 2.5 Profiler / KTP
Database peserta dan agent dengan struktur hierarki tahun, folder, dan peserta.

### 2.6 SIDAK / QA Analyzer
Modul analisis temuan QA, ranking agent, detail per agent, input temuan, periode, parameter, dan laporan.

### 2.7 Monitoring
Ringkasan aktivitas dan operasional untuk kebutuhan pengawasan internal.

## 3. Alur Produk

1. User membuka landing page.
2. User login atau mengajukan akses.
3. User masuk ke dashboard sesuai role dan status akun.
4. User berpindah ke modul yang relevan dengan pekerjaannya.
5. User dengan status `pending` diarahkan ke halaman approval.

## 4. Persona Utama

| Persona | Kebutuhan |
|---|---|
| Agent | Akses ke simulasi dan area yang diizinkan |
| Leader | Ringkasan performa tim dan aktivitas harian |
| Trainer | Pengelolaan data, QA, simulasi, dan monitoring |

## 5. Fitur Inti Saat Ini

### 5.1 Auth dan Approval
- Login menggunakan Supabase Auth.
- Registrasi mengirim akun ke status `pending`.
- User `pending` diarahkan ke halaman waiting approval.
- Reset password tersedia dari modal auth dan halaman reset password.

### 5.2 Dashboard Ringkasan
- Menampilkan ringkasan performa dan aktivitas terbaru.
- Menggunakan data QA dan activity log yang sudah ada di aplikasi.

### 5.3 QA Analyzer / SIDAK
- Halaman utama diarahkan ke dashboard SIDAK.
- Menyediakan analisis tren, ranking, detail agent, dan laporan.
- Menjaga filosofi bahwa angka turun adalah arah yang baik untuk temuan kualitas.

### 5.4 Profiler
- Menyediakan pengelolaan data peserta.
- Mendukung export dan import.
- Menjaga struktur data yang rapi untuk kebutuhan training.

### 5.5 Simulasi
- KETIK untuk chat.
- PDKT untuk email.
- TELEFUN untuk telepon.

## 6. Sistem Akses

Role yang dipakai aplikasi saat ini:
- `Agent`
- `Leader`
- `Trainer`

Selain itu, codebase juga memiliki jalur admin internal pada beberapa area tertentu untuk kebutuhan operasional dan pengelolaan data.

Aturan umum:
- Jangan membuka route sensitif tanpa pemeriksaan role.
- Jangan mengubah status approval tanpa proses yang jelas.
- Jangan menambahkan role baru tanpa pembaruan auth dan policy.

## 7. Data dan Integrasi

Sumber data utama:
- Supabase Auth untuk login
- Tabel `profiles` untuk role dan status akses
- Service QA untuk data dashboard dan analisis
- Service activity untuk log aktivitas
- Service Profiler untuk data peserta, folder, dan export

Prinsip teknis:
- Gunakan service/helper yang sudah ada.
- Jangan menaruh query besar langsung di komponen jika bisa dipusatkan di service.
- Hormati RLS dan struktur tabel yang sudah dipakai aplikasi.

## 8. UI / UX

Arahan visual aplikasi saat ini:
- modern, bersih, dan profesional
- tetap memakai tema existing
- dark mode harus tetap aman
- komponen auth dan landing page harus terasa natural, bukan copy generik

Landing page harus menjelaskan produk dengan cepat. Modal auth harus ringkas, jelas, dan tidak terasa seperti template.

## 9. Prioritas Produk

Prioritas yang paling penting saat ini:
- menjaga auth flow tetap stabil
- menjaga dashboard dan QA Analyzer tetap akurat
- menjaga Profiler tetap kompatibel dengan alur data existing
- mempertahankan konsistensi visual antar modul

## 10. Non-Goals

- Mengganti arsitektur App Router
- Mengubah stack inti
- Menambah role baru tanpa kebutuhan nyata
- Menghapus RLS atau policy yang sudah ada
- Membuat redesign yang memutus tema existing

## 11. Definition of Done

Sebuah perubahan dianggap selesai jika:
- build dan type check aman
- auth flow tidak rusak
- akses role tetap sesuai
- UI konsisten dengan tema aplikasi
- perubahan tidak memutus alur modul lain

