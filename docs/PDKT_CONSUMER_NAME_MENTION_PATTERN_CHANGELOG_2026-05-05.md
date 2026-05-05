# PDKT Consumer Name Mention Pattern Changelog

## 2026-05-05

- PDKT: tambah setting `Pola Penyebutan Nama Konsumen` dengan mode `Acak`, `Nama disebut di awal`, `Nama disebut di tengah`, `Nama disebut di akhir`, dan `Tidak menyebut nama`.
- Mode `random` dirancang untuk di-resolve sekali saat sesi dimulai, lalu hasil final dipakai stabil selama sesi.
- Prompt email awal PDKT dirancang agar bisa menahan nama sama sekali (`none`) atau menunda penyebutannya ke bagian tengah/akhir email tanpa mengubah behavior KETIK dan Telefun.
