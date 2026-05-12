# PDKT Licensed Company Name Templates Changelog

## 2026-05-12

- PDKT: tambah `isLicensed` field di `Scenario` untuk membedakan skenario berizin vs tidak berizin
- Skenario berizin (SLIK, Asuransi, Kartu Kredit) menggunakan nama perusahaan resmi dari template (BCA, Mandiri, BRI, Prudential, Allianz, dll)
- Skenario tidak berizin (Pinjol Ilegal, Penipuan Undian, Investasi Bodong) dilarang menggunakan kata "Bank", "Asuransi", atau "Sekuritas" dan menggunakan entitas karangan yang realistis (contoh: Pinjaman Kilat Nusantara, Dana Cepat 88)
- Tambah konstanta `LICENSED_COMPANY_NAMES` (15 bank + 12 asuransi) dan `SCENARIO_COMPANY_CATEGORY_MAP`
- Tambah helper `getCompanyNameInstruction()` di promptHelpers.ts dengan batasan ketat terhadap entitas LJK ilegal
- Update prompt `getSystemInstruction` dan `generateScenarioEmailTemplate` untuk dynamic company name rule serta menghapus duplikasi instruksi
- Menetapkan `isLicensed: false` secara eksplisit pada seluruh skenario ilegal default di `constants.ts` untuk mencegah ambiguitas saat *merging* pengaturan
- Implementasi Toggle UI Manual di `SettingsModal.tsx` untuk mengatur status `isLicensed` pada saat penambahan atau pengeditan skenario, memungkinkan kontrol penuh bagi admin/trainer terhadap status legalitas LJK skenario.
