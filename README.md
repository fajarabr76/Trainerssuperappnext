# Trainers SuperApp

Trainers SuperApp adalah aplikasi internal untuk operasional contact center training, simulasi, database peserta, monitoring, dan QA.

## Overview

Platform ini menggabungkan beberapa workspace utama dalam satu pengalaman yang konsisten:

- `Dashboard` untuk ringkasan performa dan aktivitas
- `KETIK` untuk simulasi chat
- `PDKT` untuk simulasi email
- `TELEFUN` untuk simulasi telepon
- `Profiler / KTP` untuk database peserta dan agent
- `SIDAK / QA Analyzer` untuk analisis temuan kualitas
- `Monitoring` untuk ringkasan operasional

Landing page dan auth flow dirancang sebagai pintu masuk tunggal ke seluruh modul tersebut.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, RLS, Storage
- Motion
- Recharts
- Lucide React

## Current Product Flow

1. User membuka landing page.
2. User login, daftar akses, atau reset password dari modal auth.
3. User yang belum disetujui diarahkan ke halaman approval.
4. User yang aktif masuk ke dashboard dan navigasi modul sesuai role.

## Roles

- `Agent`
- `Leader`
- `Trainer`

Beberapa area internal juga memiliki akses operasional tambahan sesuai kebutuhan aplikasi.

## Main Routes

- `/` landing page
- `/?auth=login` open login modal
- `/dashboard` unified dashboard
- `/dashboard/users` user management
- `/dashboard/monitoring` monitoring summary
- `/ketik` chat simulation
- `/pdkt` email simulation
- `/telefun` phone simulation
- `/profiler` profiler landing
- `/profiler/table` data table
- `/profiler/import` import flow
- `/profiler/export` export flow
- `/profiler/add` add participant
- `/profiler/teams` team management
- `/profiler/slides` slide view
- `/qa-analyzer/dashboard` SIDAK dashboard
- `/qa-analyzer/agents` agent analysis
- `/qa-analyzer/ranking` ranking view
- `/qa-analyzer/input` input temuan
- `/qa-analyzer/periods` period management
- `/qa-analyzer/settings` parameter management
- `/qa-analyzer/reports` reporting

## Product Notes

- QA Analyzer memakai filosofi `The Path to Zero`, yaitu mendorong tren temuan ke arah yang semakin kecil.
- Profiler mempertahankan struktur data yang hierarkis agar operasional training tetap rapi.
- Landing page dan auth modal dijaga supaya copy-nya terasa natural, bukan generik atau terlalu "AI".

## Getting Started

```bash
npm install
npm run dev
```

## Environment

Biasanya aplikasi membutuhkan variabel seperti:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Jika fitur tertentu memakai integrasi tambahan, cek file konfigurasi dan service yang relevan di `app/lib`.

## Development Notes

- Gunakan `app/(main)` sebagai area aplikasi utama.
- Ikuti pola service dan hook yang sudah ada di repo.
- Jangan ubah auth flow atau RLS tanpa kebutuhan yang jelas.
- Pertahankan tema visual existing ketika menambah halaman atau komponen baru.

## Verification

Sebelum menyelesaikan perubahan besar, jalankan:

```bash
npm run type-check
npm run lint
```

## License

Private internal project.

