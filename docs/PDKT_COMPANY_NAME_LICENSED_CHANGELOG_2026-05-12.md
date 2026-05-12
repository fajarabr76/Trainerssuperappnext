# PDKT Licensed Company Name Templates Changelog

## 2026-05-12

- PDKT: tambah `isLicensed` field di `Scenario` untuk membedakan skenario berizin vs tidak berizin
- Skenario berizin (SLIK, Asuransi, Kartu Kredit) menggunakan nama perusahaan resmi dari template (BCA, Mandiri, BRI, Prudential, Allianz, dll)
- Skenario tidak berizin (Pinjol Ilegal, Penipuan Undian, Investasi Bodong) tetap menggunakan nama karangan
- Tambah konstanta `LICENSED_COMPANY_NAMES` (15 bank + 12 asuransi) dan `SCENARIO_COMPANY_CATEGORY_MAP`
- Tambah helper `getCompanyNameInstruction()` di promptHelpers.ts
- Update prompt `getSystemInstruction` dan `generateScenarioEmailTemplate` untuk dynamic company name rule
