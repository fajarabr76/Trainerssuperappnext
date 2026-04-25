# Rencana Perbaikan: Field Alamat Belum Muncul di Profiler Table

## Masalah
Saat ini field `alamat_tinggal` belum tersedia di **Edit Modal** pada halaman profiler table. Akibatnya, data alamat yang sudah ada tidak bisa dilihat atau diperbarui dari surface ini.

Data alamat hanya bisa dilihat di:
- Slides view (`/profiler/slides`)
- Export Excel
- Form tambah data manual (`/profiler/add`)

## Solusi

### 1. Menambahkan Field Alamat di Edit Modal

**File:** `app/(main)/profiler/table/components/ProfilerTableClient.tsx`

**Lokasi:** Bagian "Informasi Personal" (sekitar baris 472-477), setelah field "Status Tempat Tinggal"

**Perubahan:**
- Menambahkan `textarea` untuk field `alamat_tinggal`
- Menggunakan `col-span-2` agar field mengambil lebar penuh
- Menggunakan `rows={3}` untuk input multi-baris yang nyaman
- Diletakkan dalam section "Informasi Personal" yang sudah ada
- Menggunakan binding state yang sama seperti field lain (`value={form.alamat_tinggal || ''}` dan `onChange={e => set('alamat_tinggal', e.target.value)}`)

**Kode yang akan ditambahkan:**
```tsx
<div className="col-span-2">
  <label className={labelClass}>Alamat Tinggal</label>
  <textarea 
    rows={3} 
    placeholder="Masukkan alamat lengkap..." 
    className={inputClass + " resize-none"} 
    value={form.alamat_tinggal || ''} 
    onChange={e => set('alamat_tinggal', e.target.value)} 
  />
</div>
```

**Posisi:** Setelah baris 476 (field "Status Tempat Tinggal"), sebelum penutup `</div>` grid

### 2. Validasi Scope

- Tidak ada perubahan pada schema database
- Tidak ada perubahan pada service/action save
- Field `alamat_tinggal` sudah ada di type `Peserta`
- Form tambah data manual sudah lebih dulu memakai field ini, jadi perubahan hanya membuka parity di edit modal table

### 3. Verifikasi

Setelah perubahan:
- Buka halaman profiler table
- Klik salah satu peserta untuk membuka Edit Modal
- Pastikan field "Alamat Tinggal" muncul di bagian "Informasi Personal"
- Coba isi/edit alamat dan simpan
- Verifikasi data tersimpan dengan membuka kembali modal atau cek di Slides view
- Jalankan `npm run lint` untuk memastikan tidak ada error linting

## Dampak
- **Minimal** - Hanya menambahkan 1 field input baru di modal yang sudah ada
- Tidak mengubah card/list view
- Tidak mengubah logic data fetching atau saving
- Field sudah ada di database dan tipe TypeScript, hanya UI yang belum menampilkannya

## Catatan
- Plan ini hanya mencakup **Edit Modal**.
- Jika kebutuhan sebenarnya adalah menampilkan alamat juga di card/list view, itu perlu dijadikan perubahan lanjutan terpisah agar scope tetap jelas.

## File yang Dimodifikasi
1. `app/(main)/profiler/table/components/ProfilerTableClient.tsx` - EditModal component
