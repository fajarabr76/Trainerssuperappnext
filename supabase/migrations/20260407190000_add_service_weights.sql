-- ① Buat tabel qa_service_weights
CREATE TABLE qa_service_weights (
  service_type         text PRIMARY KEY,
  critical_weight      numeric NOT NULL DEFAULT 0.5,
  non_critical_weight  numeric NOT NULL DEFAULT 0.5,
  scoring_mode         text    NOT NULL DEFAULT 'weighted',
  updated_at           timestamptz DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id),

  CONSTRAINT weights_sum_check
    CHECK (ABS(critical_weight + non_critical_weight - 1.0) < 0.001),
  CONSTRAINT scoring_mode_check
    CHECK (scoring_mode IN ('weighted', 'flat', 'no_category'))
);

-- ② Seed data semua service type
INSERT INTO qa_service_weights
  (service_type, critical_weight, non_critical_weight, scoring_mode)
VALUES
  ('call',       0.50, 0.50, 'weighted'),
  ('chat',       0.50, 0.50, 'weighted'),
  ('email',      0.65, 0.35, 'weighted'),
  ('cso',        0.50, 0.50, 'weighted'),
  ('pencatatan', 0.90, 0.10, 'flat'),
  ('bko',        0.50, 0.50, 'no_category'),
  ('slik',       0.60, 0.40, 'weighted');

-- ③ Izinkan category = 'none' untuk BKO/SLIK
ALTER TABLE qa_indicators
DROP CONSTRAINT IF EXISTS qa_indicators_category_check;

ALTER TABLE qa_indicators
ADD CONSTRAINT qa_indicators_category_check
CHECK (category IN ('critical', 'non_critical', 'none'));

-- ④ Seed parameter BKO
INSERT INTO qa_indicators (service_type, name, category, bobot, has_na)
VALUES
  ('bko', 'Ketepatan Waktu',                           'none', 0.40, false),
  ('bko', 'Kesesuaian Informasi pada Email',           'none', 0.10, false),
  ('bko', 'Akurasi Kriteria Pemberian SP',             'none', 0.10, false),
  ('bko', 'Kesesuaian Penanganan Pengaduan',           'none', 0.10, false),
  ('bko', 'Kesesuaian Data pada Kertas Kerja',         'none', 0.15, false),
  ('bko', 'Kesesuaian Data pada APPK',                 'none', 0.15, false);

-- ⑤ RLS
ALTER TABLE qa_service_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weights_read_all" ON qa_service_weights
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "weights_write_auth" ON qa_service_weights
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer', 'trainers')
    )
  );
