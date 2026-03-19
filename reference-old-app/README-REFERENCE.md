# Reference Old App (Vite + React)

Folder ini berisi kode sumber dari aplikasi versi lama sebelum migrasi ke Next.js. 
Folder ini bersifat **Read-Only** dan hanya digunakan sebagai referensi logika bisnis, prompt Gemini, dan pola UI.

## Struktur Folder Utama
- `/src/components`: Komponen UI lama.
- `/src/pages`: Halaman aplikasi lama (Ketik, PDKT, Telefun).
- `/src/context`: Pengaturan state global lama.
- `vite.config.ts`: Konfigurasi build lama.

## Catatan Penting
- Logika AI di versi ini masih berada di sisi klien (`src/services` atau langsung di komponen).
- Routing menggunakan `react-router-dom`.
- Styling menggunakan Tailwind CSS v4.
