-- Fix SIDAK Summary Refresh Permission to use SECURITY DEFINER.
-- This allows the function to write to summary tables even if the caller (authenticated)
-- does not have direct INSERT permissions on those tables.
-- Added guards for folder_key and caller role.

CREATE OR REPLACE FUNCTION public.refresh_qa_dashboard_summary_for_period(
  p_period_id uuid,
  p_folder_key text DEFAULT '__ALL__'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  -- Guard: Only __ALL__ folder key is supported for now
  IF p_folder_key <> '__ALL__' THEN
    RAISE EXCEPTION 'Only folder_key = ''__ALL__'' is supported for summary refresh.';
  END IF;

  -- Guard: Only active, non-deleted trainers/admins or service_role can execute refresh
  IF auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND lower(coalesce(role, '')) IN ('trainer', 'trainers', 'admin')
        AND lower(coalesce(status, 'approved')) = 'approved'
        AND coalesce(is_deleted, false) = false
    ) THEN
      RAISE EXCEPTION 'Access denied: Only trainers or admins can refresh summaries.';
    END IF;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.refresh_qa_dashboard_summary_for_period(uuid, text) TO authenticated, service_role;
