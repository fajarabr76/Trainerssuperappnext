-- Fix qa_score_agent after versioned rules rollout.
-- PostgreSQL does not support MAX(uuid), and dashboard range scoring can span multiple periods.
-- Group sessions by period + ticket key to avoid merging same ticket ids across periods.

CREATE OR REPLACE FUNCTION public.qa_score_agent(
  p_peserta_id uuid,
  p_period_ids uuid[],
  p_service_type text,
  p_year integer
)
RETURNS float
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
  v_final_score float;

  v_sum_nc_bobot float;
  v_sum_nc_earned float;
  v_sum_cr_bobot float;
  v_sum_cr_earned float;

  v_scoring_mode text;
  v_critical_weight numeric;
  v_non_critical_weight numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM qa_temuan
    WHERE peserta_id = p_peserta_id
      AND period_id = ANY(p_period_ids)
      AND service_type = p_service_type
      AND tahun = p_year
      AND is_phantom_padding = false
  ) THEN
    RETURN 100.0;
  END IF;

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
      FROM qa_service_rule_versions
      WHERE id = v_session_records.v_rule_id;
    ELSE
      SELECT scoring_mode, critical_weight, non_critical_weight
      INTO v_scoring_mode, v_critical_weight, v_non_critical_weight
      FROM qa_service_weights
      WHERE service_type = p_service_type;
    END IF;

    v_scoring_mode := COALESCE(v_scoring_mode, 'weighted');
    v_critical_weight := COALESCE(v_critical_weight, 0.5);
    v_non_critical_weight := COALESCE(v_non_critical_weight, 0.5);

    v_sum_nc_bobot := 0.0;
    v_sum_nc_earned := 0.0;
    v_sum_cr_bobot := 0.0;
    v_sum_cr_earned := 0.0;

    IF v_session_records.v_rule_id IS NOT NULL THEN
      FOR v_indicator IN (
        SELECT id::text AS id, category, bobot
        FROM qa_service_rule_indicators
        WHERE rule_version_id = v_session_records.v_rule_id
      ) LOOP
        v_nilai := 3;
        v_idx := array_position(v_session_records.ind_arr, v_indicator.id);
        IF v_idx IS NOT NULL THEN
          v_nilai := v_session_records.val_arr[v_idx];
        END IF;

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
        SELECT id::text AS id, category, bobot
        FROM qa_indicators
        WHERE service_type = p_service_type
      ) LOOP
        v_nilai := 3;
        v_idx := array_position(v_session_records.ind_arr, v_indicator.id);
        IF v_idx IS NOT NULL THEN
          v_nilai := v_session_records.val_arr[v_idx];
        END IF;

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
      IF (v_sum_nc_bobot + v_sum_cr_bobot) = 0 THEN
        v_session_score := 100.0;
      ELSE
        v_session_score := ((v_sum_nc_earned + v_sum_cr_earned) / (v_sum_nc_bobot + v_sum_cr_bobot)) * 100.0;
      END IF;
    ELSE
      IF v_sum_nc_bobot = 0.0 THEN
        v_nc_score := 100.0;
      ELSE
        v_nc_score := (v_sum_nc_earned / v_sum_nc_bobot) * 100.0;
      END IF;

      IF v_sum_cr_bobot = 0.0 THEN
        v_cr_score := 100.0;
      ELSE
        v_cr_score := (v_sum_cr_earned / v_sum_cr_bobot) * 100.0;
      END IF;

      v_session_score := (v_nc_score * v_non_critical_weight) + (v_cr_score * v_critical_weight);
    END IF;

    v_session_scores := array_append(v_session_scores, v_session_score::float);
  END LOOP;

  SELECT array_agg(s ORDER BY s ASC) INTO v_session_scores FROM unnest(v_session_scores) s;
  v_session_scores := v_session_scores[1:5];

  WHILE array_length(v_session_scores, 1) IS NULL OR array_length(v_session_scores, 1) < 5 LOOP
    v_session_scores := array_append(v_session_scores, 100.0::float);
  END LOOP;

  SELECT SUM(s) / 5.0 INTO v_final_score FROM unnest(v_session_scores) s;
  RETURN v_final_score;
END;
$$;
