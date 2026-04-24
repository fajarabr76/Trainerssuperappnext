# Fix: Email Balasan Terpotong di PDKT

## Masalah
Pada modul PDKT, ketika user memberikan jawaban melalui fitur "Balas", email balasan user tidak ditampilkan secara penuh di bagian "Riwayat" - teks terpotong hanya 3 baris.

## Root Cause
File: `app/(main)/pdkt/components/EmailInterface.tsx` line 311

Class Tailwind `line-clamp-3` pada div body email membatasi tampilan maksimal 3 baris dengan ellipsis.

```tsx
<div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
  {email.body}
</div>
```

## Solusi
Hapus class `line-clamp-3` agar body email balasan ditampilkan penuh.

### File yang diubah
- `app/(main)/pdkt/components/EmailInterface.tsx`

### Perubahan
```diff
-                          <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
+                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
```

## Status
✅ **SELESAI** - Perubahan sudah diterapkan dan lolos linting.

## Verifikasi Manual
1. Buka halaman PDKT di browser
2. Kirim balasan email dengan teks panjang
3. Pastikan balasan ditampilkan penuh di bagian "Riwayat" tanpa terpotong
