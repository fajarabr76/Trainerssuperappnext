-- QA Analyzer Dashboard Summary Rollup Cache v1
-- Add durable summary tables to avoid recomputing dashboard KPIs from raw qa_temuan rows.

-- 1. Period-level summary (global + per-folder)
CREATE TABLE IF NOT EXISTS qa_dashboard_period_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES qa_periods(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  folder_key text NOT NULL DEFAULT '__ALL__',
  total_agents int NOT NULL DEFAULT 0,
  total_defects int NOT NULL DEFAULT 0,
  avg_defects_per_audit float NOT NULL DEFAULT 0.0,
  zero_error_count int NOT NULL DEFAULT 0,
  zero_error_rate float NOT NULL DEFAULT 0.0,
  avg_agent_score float NOT NULL DEFAULT 0.0,
  compliance_count int NOT NULL DEFAULT 0,
  compliance_rate float NOT NULL DEFAULT 0.0,
  critical_count int NOT NULL DEFAULT 0,
  non_critical_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qa_dashboard_period_summary UNIQUE (period_id, service_type, folder_key)
);

CREATE INDEX IF NOT EXISTS idx_qa_dashboard_period_summary_lookup
  ON qa_dashboard_period_summary (period_id, service_type, folder_key);

-- 2. Indicator-level summary per period
CREATE TABLE IF NOT EXISTS qa_dashboard_indicator_period_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES qa_periods(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  folder_key text NOT NULL DEFAULT '__ALL__',
  indicator_key text NOT NULL,
  rule_indicator_id uuid,
  legacy_indicator_id uuid,
  indicator_name text NOT NULL,
  indicator_category text NOT NULL,
  total_defects int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qa_dashboard_indicator_period_summary UNIQUE (period_id, service_type, folder_key, indicator_key)
);

CREATE INDEX IF NOT EXISTS idx_qa_dashboard_indicator_period_summary_lookup
  ON qa_dashboard_indicator_period_summary (period_id, service_type, folder_key);

-- 3. Agent-level summary per period
CREATE TABLE IF NOT EXISTS qa_dashboard_agent_period_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES qa_periods(id) ON DELETE CASCADE,
  peserta_id uuid NOT NULL,
  service_type text NOT NULL,
  folder_key text NOT NULL DEFAULT '__ALL__',
  nama text NOT NULL,
  tim text,
  batch_name text,
  jabatan text,
  defects int NOT NULL DEFAULT 0,
  session_count int NOT NULL DEFAULT 0,
  session_scores float[] NOT NULL DEFAULT '{}',
  score float NOT NULL DEFAULT 0.0,
  has_critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qa_dashboard_agent_period_summary UNIQUE (period_id, peserta_id, service_type, folder_key)
);

CREATE INDEX IF NOT EXISTS idx_qa_dashboard_agent_period_summary_lookup
  ON qa_dashboard_agent_period_summary (period_id, service_type, folder_key);

CREATE INDEX IF NOT EXISTS idx_qa_dashboard_agent_period_summary_peserta
  ON qa_dashboard_agent_period_summary (peserta_id, service_type);

-- 4. Helper: return raw session scores array for an agent across periods.
CREATE OR REPLACE FUNCTION public._qa_session_scores(
  p_peserta_id uuid,
  p_period_ids uuid[],
  p_service_type text,
  p_year integer
)
RETURNS float[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_scores float[] := '{}';
  v_session_records record;
  v_indicator record;
  v_nilai int;
  v_idx int;
  v_nc_score float;
  v_cr_score float;
  v_session_score float;
  v_sum_nc_bobot float;
  v_sum_nc_earned float;
  v_sum_cr_bobot float;
  v_sum_cr_earned float;
  v_scoring_mode text;
  v_critical_weight numeric;
  v_non_critical_weight numeric;
BEGIN
  FOR v_session_records IN (
    WITH session_data AS (
      SELECT
        period_id,
        COALESCE(rule_indicator_id, indicator_id) AS any_indicator_id,
        rule_version_id,
        nilai,
        CASE
          WHEN no_tiket IS NOT NULL AND TRIM(no_tiket) != '' THEN TRIM(no_tiket)
          ELSE '__nt_' || TO_CHAR(created_at, 'YYYYMMDD_HH24MISS')
        END AS ticket_key
      FROM qa_temuan
      WHERE peserta_id = p_peserta_id
        AND period_id = ANY(p_period_ids)
        AND service_type = p_service_type
        AND tahun = p_year
        AND is_phantom_padding = false
    )
    SELECT
      period_id,
      ticket_key AS session_key,
      (array_agg(rule_version_id) FILTER (WHERE rule_version_id IS NOT NULL))[1] AS v_rule_id,
      array_agg(any_indicator_id::text) AS ind_arr,
      array_agg(nilai) AS val_arr
    FROM session_data
    GROUP BY period_id, ticket_key
  ) LOOP
    IF v_session_records.v_rule_id IS NOT NULL THEN
      SELECT scoring_mode, critical_weight, non_critical_weight
      INTO v_scoring_mode, v_critical_weight, v_non_critical_weight
      FROM qa_service_rule_versions WHERE id = v_session_records.v_rule_id;
    ELSE
      SELECT scoring_mode, critical_weight, non_critical_weight
      INTO v_scoring_mode, v_critical_weight, v_non_critical_weight
      FROM qa_service_weights WHERE service_type = p_service_type;
    END IF;
    v_scoring_mode := COALESCE(v_scoring_mode, 'weighted');
    v_critical_weight := COALESCE(v_critical_weight, 0.5);
    v_non_critical_weight := COALESCE(v_non_critical_weight, 0.5);
    v_sum_nc_bobot := 0.0; v_sum_nc_earned := 0.0; v_sum_cr_bobot := 0.0; v_sum_cr_earned := 0.0;
    IF v_session_records.v_rule_id IS NOT NULL THEN
      FOR v_indicator IN (
        SELECT id::text AS id, category, bobot FROM qa_service_rule_indicators
        WHERE rule_version_id = v_session_records.v_rule_id
      ) LOOP
        v_nilai := 3;
        v_idx := array_position(v_session_records.ind_arr, v_indicator.id);
        IF v_idx IS NOT NULL THEN v_nilai := v_session_records.val_arr[v_idx]; END IF;
        IF v_indicator.category = 'non_critical' THEN
          v_sum_nc_bobot := v_sum_nc_bobot + v_indicator.bobot;
          v_sum_nc_earned := v_sum_nc_earned + ((v_nilai::float / 3.0) * v_indicator.bobot);
        ELSIF v_indicator.category = 'critical' THEN
          v_sum_cr_bobot := v_sum_cr_bobot + v_indicator.bobot;
          v_sum_cr_earned := v_sum_cr_earned + ((v_nilai::float / 3.0) * v_indicator.bobot);
        END IF;
      END LOOP;
    ELSE
      FOR v_indicator IN (
        SELECT id::text AS id, category, bobot FROM qa_indicators WHERE service_type = p_service_type
      ) LOOP
        v_nilai := 3;
        v_idx := array_position(v_session_records.ind_arr, v_indicator.id);
        IF v_idx IS NOT NULL THEN v_nilai := v_session_records.val_arr[v_idx]; END IF;
        IF v_indicator.category = 'non_critical' THEN
          v_sum_nc_bobot := v_sum_nc_bobot + v_indicator.bobot;
          v_sum_nc_earned := v_sum_nc_earned + ((v_nilai::float / 3.0) * v_indicator.bobot);
        ELSIF v_indicator.category = 'critical' THEN
          v_sum_cr_bobot := v_sum_cr_bobot + v_indicator.bobot;
          v_sum_cr_earned := v_sum_cr_earned + ((v_nilai::float / 3.0) * v_indicator.bobot);
        END IF;
      END LOOP;
    END IF;
    IF v_scoring_mode = 'flat' OR v_scoring_mode = 'no_category' THEN
      IF (v_sum_nc_bobot + v_sum_cr_bobot) = 0 THEN v_session_score := 100.0;
      ELSE v_session_score := ((v_sum_nc_earned + v_sum_cr_earned) / (v_sum_nc_bobot + v_sum_cr_bobot)) * 100.0;
      END IF;
    ELSE
      IF v_sum_nc_bobot = 0.0 THEN v_nc_score := 100.0;
      ELSE v_nc_score := (v_sum_nc_earned / v_sum_nc_bobot) * 100.0;
      END IF;
      IF v_sum_cr_bobot = 0.0 THEN v_cr_score := 100.0;
      ELSE v_cr_score := (v_sum_cr_earned / v_sum_cr_bobot) * 100.0;
      END IF;
      v_session_score := (v_nc_score * v_non_critical_weight) + (v_cr_score * v_critical_weight);
    END IF;
    v_session_scores := array_append(v_session_scores, v_session_score::float);
  END LOOP;
  RETURN v_session_scores;
END;
$$;

-- 5. Rebuild summary for a single period + optional folder.
--    Called by mutations to keep summary warm.
--    For now supports folder_key = '__ALL__' only; per-folder rebuild can be extended later.
CREATE OR REPLACE FUNCTION public.refresh_qa_dashboard_summary_for_period(
  p_period_id uuid,
  p_folder_key text DEFAULT '__ALL__'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_period record;
  v_service_type text;
  v_total_agents int;
  v_total_defects int;
  v_zero_error_count int;
  v_avg_defects float;
  v_zero_error_rate float;
  v_avg_agent_score float;
  v_compliance_count int;
  v_compliance_rate float;
  v_critical_count int;
  v_non_critical_count int;
  v_total_agent_score float;
  v_agent_id uuid;
  v_agent_score float;
BEGIN
  SELECT year, month INTO v_period FROM qa_periods WHERE id = p_period_id;
  IF v_period IS NULL THEN
    RETURN;
  END IF;

  -- Clean stale summary rows for ALL service_types in this period first.
  -- This handles the case where the last temuan for a service_type is deleted.
  DELETE FROM qa_dashboard_period_summary
  WHERE period_id = p_period_id AND folder_key = p_folder_key;
  DELETE FROM qa_dashboard_indicator_period_summary
  WHERE period_id = p_period_id AND folder_key = p_folder_key;
  DELETE FROM qa_dashboard_agent_period_summary
  WHERE period_id = p_period_id AND folder_key = p_folder_key;

  -- Rebuild only for service_types that still have data
  FOR v_service_type IN
    SELECT DISTINCT q.service_type
    FROM qa_temuan q
    WHERE q.period_id = p_period_id
  LOOP
    -- Delete old summary rows for this (period, service, folder) — no-op now since we purge all above, kept for clarity
    -- (summary already cleaned before loop)

    DROP TABLE IF EXISTS temp_qa_summary_base;
    CREATE TEMP TABLE temp_qa_summary_base ON COMMIT DROP AS
    SELECT
      q.peserta_id,
      q.indicator_id,
      q.rule_indicator_id,
      q.service_type,
      q.no_tiket,
      q.nilai,
      COALESCE(q.is_phantom_padding, false) AS is_phantom_padding,
      (
        COALESCE(q.is_phantom_padding, false) = false AND (
          q.nilai < 3
          OR NULLIF(TRIM(COALESCE(q.ketidaksesuaian, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(q.sebaiknya, '')), '') IS NOT NULL
        )
      ) AS is_countable_finding,
      p.nama,
      p.batch_name,
      p.tim,
      p.jabatan
    FROM qa_temuan q
    JOIN profiler_peserta p ON p.id = q.peserta_id
    WHERE q.period_id = p_period_id
      AND q.service_type = v_service_type
      AND lower(trim(coalesce(p.tim, ''))) NOT IN ('tim om', 'tim qa', 'tim spv', 'tim da & konten')
      AND lower(trim(coalesce(p.batch_name, ''))) NOT IN ('tim om', 'tim qa', 'tim spv', 'tim da & konten')
      AND lower(trim(coalesce(p.jabatan, ''))) NOT IN (
        'qa', 'trainer', 'wfm', 'team leader', 'team_leader', 'supervisor',
        'spv', 'operational manager', 'operation_manager', 'operation manager'
      );

    SELECT
      COUNT(DISTINCT peserta_id),
      COUNT(*) FILTER (WHERE is_countable_finding)
    INTO v_total_agents, v_total_defects
    FROM temp_qa_summary_base;

    v_avg_defects := v_total_defects::float / NULLIF(v_total_agents, 0);

    SELECT COUNT(DISTINCT b.peserta_id)
    INTO v_zero_error_count
    FROM temp_qa_summary_base b
    WHERE NOT EXISTS (
      SELECT 1 FROM temp_qa_summary_base b2
      WHERE b2.peserta_id = b.peserta_id AND b2.is_countable_finding
    );

    v_zero_error_rate := (v_zero_error_count::float / NULLIF(v_total_agents, 0)) * 100.0;

    v_total_agent_score := 0.0;
    v_compliance_count := 0;

    FOR v_agent_id IN
      SELECT DISTINCT peserta_id FROM temp_qa_summary_base
    LOOP
      v_agent_score := qa_score_agent(v_agent_id, ARRAY[p_period_id], v_service_type, v_period.year);
      v_total_agent_score := v_total_agent_score + v_agent_score;
      IF v_agent_score >= 95.0 THEN
        v_compliance_count := v_compliance_count + 1;
      END IF;
    END LOOP;

    v_avg_agent_score := v_total_agent_score / NULLIF(v_total_agents, 0);
    v_compliance_rate := (v_compliance_count::float / NULLIF(v_total_agents, 0)) * 100.0;

    SELECT
      COUNT(*) FILTER (WHERE COALESCE(ri.category, i.category) = 'critical'),
      COUNT(*) FILTER (WHERE COALESCE(ri.category, i.category) = 'non_critical')
    INTO v_critical_count, v_non_critical_count
    FROM temp_qa_summary_base b
    LEFT JOIN qa_indicators i ON i.id = b.indicator_id
    LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
    WHERE b.is_countable_finding;

    -- Insert period summary
    INSERT INTO qa_dashboard_period_summary (
      period_id, service_type, folder_key,
      total_agents, total_defects, avg_defects_per_audit,
      zero_error_count, zero_error_rate,
      avg_agent_score, compliance_count, compliance_rate,
      critical_count, non_critical_count
    ) VALUES (
      p_period_id, v_service_type, p_folder_key,
      COALESCE(v_total_agents, 0), COALESCE(v_total_defects, 0), COALESCE(v_avg_defects, 0.0),
      COALESCE(v_zero_error_count, 0), COALESCE(v_zero_error_rate, 0.0),
      COALESCE(v_avg_agent_score, 0.0), COALESCE(v_compliance_count, 0), COALESCE(v_compliance_rate, 0.0),
      COALESCE(v_critical_count, 0), COALESCE(v_non_critical_count, 0)
    );

    -- Insert indicator summary
    INSERT INTO qa_dashboard_indicator_period_summary (
      period_id, service_type, folder_key,
      indicator_key, rule_indicator_id, legacy_indicator_id,
      indicator_name, indicator_category, total_defects
    )
    SELECT
      p_period_id, v_service_type, p_folder_key,
      COALESCE(ri.name, i.name),
      b.rule_indicator_id,
      b.indicator_id,
      COALESCE(ri.name, i.name),
      COALESCE(ri.category, i.category),
      COUNT(*) FILTER (WHERE b.is_countable_finding)
    FROM temp_qa_summary_base b
    LEFT JOIN qa_indicators i ON i.id = b.indicator_id
    LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
    GROUP BY COALESCE(ri.name, i.name), b.rule_indicator_id, b.indicator_id, COALESCE(ri.category, i.category);

    -- Insert agent summary
    INSERT INTO qa_dashboard_agent_period_summary (
      period_id, peserta_id, service_type, folder_key,
      nama, tim, batch_name, jabatan,
      defects, session_count, session_scores, score, has_critical
    )
    SELECT
      p_period_id,
      b.peserta_id,
      v_service_type,
      p_folder_key,
      b.nama,
      b.tim,
      b.batch_name,
      b.jabatan,
      COUNT(*) FILTER (WHERE b.is_countable_finding),
      COUNT(DISTINCT b.no_tiket),
      _qa_session_scores(b.peserta_id, ARRAY[p_period_id], v_service_type, v_period.year),
      qa_score_agent(b.peserta_id, ARRAY[p_period_id], v_service_type, v_period.year),
      BOOL_OR(
        b.is_countable_finding
        AND b.nilai = 0
        AND COALESCE(ri.category, i.category) = 'critical'
      )
    FROM temp_qa_summary_base b
    LEFT JOIN qa_indicators i ON i.id = b.indicator_id
    LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
    GROUP BY b.peserta_id, b.nama, b.tim, b.batch_name, b.jabatan;

  END LOOP;
END;
$$;
