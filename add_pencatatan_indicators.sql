-- Add indicators for 'pencatatan' service type
-- This script adds 7 new indicators as requested.

INSERT INTO qa_indicators (service_type, name, category, bobot, has_na)
VALUES 
  ('pencatatan', 'Ketepatan Waktu', 'critical', 0.4, true),
  ('pencatatan', 'Typing', 'critical', 0.02, true),
  ('pencatatan', 'Double Input', 'critical', 0.03, true),
  ('pencatatan', 'Accuracy Description', 'critical', 0.15, true),
  ('pencatatan', 'Dokumentasi', 'critical', 0.3, true),
  ('pencatatan', 'Proper Input: Kesesuaian pemilihan Media Layanan, Tiket Layanan dan Data Konsumen', 'non_critical', 0.07, true),
  ('pencatatan', 'Proper Input: Kesesuaian pemilihan Nama PUJK/Perusahaan, Jenis Produk, dan Jenis Permasalahan', 'non_critical', 0.03, true)
ON CONFLICT (service_type, name) DO NOTHING;
