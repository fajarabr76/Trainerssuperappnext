-- Fix ambiguous category reference in get_qa_dashboard_range_data.

CREATE OR REPLACE FUNCTION public.get_qa_dashboard_range_data(
  p_service_type text,
  p_year integer,
  p_start_month integer,
  p_end_month integer,
  p_folder_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_ids uuid[];
  v_summary_json jsonb;
  v_pareto_json jsonb;
  v_service_json jsonb;
  v_donut_json jsonb;
  v_top_agents_json jsonb;
  v_total_agents int := 0;
  v_total_defects int := 0;
  v_avg_defects float := 0.0;
  v_zero_error_count int := 0;
  v_zero_error_rate float := 0.0;
  v_avg_agent_score float := 0.0;
  v_compliance_count int := 0;
  v_compliance_rate float := 0.0;
  v_total_agent_score float := 0.0;
  v_critical_count int := 0;
  v_non_critical_count int := 0;
  v_agent_id uuid;
  v_agent_score float;
BEGIN
  SELECT array_agg(id ORDER BY year, month)
  INTO v_period_ids
  FROM qa_periods
  WHERE year = p_year
    AND month BETWEEN p_start_month AND p_end_month;

  IF v_period_ids IS NULL OR array_length(v_period_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  DROP TABLE IF EXISTS temp_qa_range_base;
  CREATE TEMP TABLE temp_qa_range_base ON COMMIT DROP AS
  SELECT
    q.peserta_id,
    q.indicator_id,
    q.rule_indicator_id,
    q.service_type,
    q.no_tiket,
    q.nilai,
    q.period_id,
    q.is_phantom_padding,
    (
      q.is_phantom_padding = false AND (
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
  WHERE q.tahun = p_year
    AND q.period_id = ANY(v_period_ids)
    AND (
      array_length(p_folder_ids, 1) IS NULL
      OR p.batch_name = ANY(p_folder_ids)
    )
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
  FROM temp_qa_range_base
  WHERE service_type = p_service_type
    AND is_phantom_padding = false;

  v_avg_defects := v_total_defects::float / NULLIF(v_total_agents, 0);

  SELECT COUNT(DISTINCT b.peserta_id)
  INTO v_zero_error_count
  FROM temp_qa_range_base b
  WHERE b.service_type = p_service_type
    AND b.is_phantom_padding = false
    AND NOT EXISTS (
      SELECT 1
      FROM temp_qa_range_base b2
      WHERE b2.peserta_id = b.peserta_id
        AND b2.service_type = p_service_type
        AND b2.is_phantom_padding = false
        AND b2.nilai < 3
    );

  v_zero_error_rate := (v_zero_error_count::float / NULLIF(v_total_agents, 0)) * 100.0;

  FOR v_agent_id IN (
    SELECT DISTINCT peserta_id
    FROM temp_qa_range_base
    WHERE service_type = p_service_type
      AND is_phantom_padding = false
  ) LOOP
    v_agent_score := qa_score_agent(v_agent_id, v_period_ids, p_service_type, p_year);
    v_total_agent_score := v_total_agent_score + v_agent_score;

    IF v_agent_score >= 95.0 THEN
      v_compliance_count := v_compliance_count + 1;
    END IF;
  END LOOP;

  v_avg_agent_score := v_total_agent_score / NULLIF(v_total_agents, 0);
  v_compliance_rate := (v_compliance_count::float / NULLIF(v_total_agents, 0)) * 100.0;

  v_summary_json := jsonb_build_object(
    'totalDefects', COALESCE(v_total_defects, 0),
    'avgDefectsPerAudit', ROUND(COALESCE(v_avg_defects, 0.0)::numeric, 2)::float,
    'zeroErrorRate', ROUND(COALESCE(v_zero_error_rate, 0.0)::numeric, 2)::float,
    'avgAgentScore', ROUND(COALESCE(v_avg_agent_score, 0.0)::numeric, 2)::float,
    'complianceRate', ROUND(COALESCE(v_compliance_rate, 0.0)::numeric, 2)::float,
    'complianceCount', COALESCE(v_compliance_count, 0),
    'totalAgents', COALESCE(v_total_agents, 0)
  );

  WITH pareto_counts AS (
    SELECT
      COALESCE(ri.name, i.name) AS param_name,
      COALESCE(ri.category, i.category) AS param_category,
      COUNT(*) AS count_defects
    FROM temp_qa_range_base b
    LEFT JOIN qa_indicators i ON i.id = b.indicator_id
    LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
    WHERE b.service_type = p_service_type
      AND b.is_countable_finding
    GROUP BY COALESCE(ri.name, i.name), COALESCE(ri.category, i.category)
  ),
  pareto_cumulative AS (
    SELECT
      param_name,
      param_category,
      count_defects,
      SUM(count_defects) OVER (ORDER BY count_defects DESC, param_name ASC) AS running_total,
      SUM(count_defects) OVER () AS overall_total
    FROM pareto_counts
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', param_name,
      'fullName', param_name,
      'count', count_defects,
      'cumulative', ROUND(((running_total::float / NULLIF(overall_total, 0)) * 100.0)::numeric, 1)::float,
      'category', param_category
    ) ORDER BY count_defects DESC, param_name ASC
  ), '[]'::jsonb)
  INTO v_pareto_json
  FROM pareto_cumulative;

  WITH service_summary AS (
    SELECT service_type, COUNT(*) FILTER (WHERE is_countable_finding) AS total_defects
    FROM temp_qa_range_base
    GROUP BY service_type
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', CASE service_type WHEN 'call' THEN 'Layanan Call' WHEN 'chat' THEN 'Layanan Chat' WHEN 'email' THEN 'Layanan Email' WHEN 'cso' THEN 'Layanan CSO' WHEN 'pencatatan' THEN 'Pencatatan' WHEN 'bko' THEN 'BKO' WHEN 'slik' THEN 'SLIK' ELSE service_type END,
    'serviceType', service_type,
    'total', total_defects,
    'severity', CASE WHEN total_defects > 50 THEN 'Critical' WHEN total_defects > 30 THEN 'High' WHEN total_defects > 15 THEN 'Medium' ELSE 'Low' END
  )), '[]'::jsonb)
  INTO v_service_json
  FROM service_summary;

  SELECT
    COUNT(*) FILTER (WHERE COALESCE(ri.category, i.category) = 'critical'),
    COUNT(*) FILTER (WHERE COALESCE(ri.category, i.category) = 'non_critical')
  INTO v_critical_count, v_non_critical_count
  FROM temp_qa_range_base b
  LEFT JOIN qa_indicators i ON i.id = b.indicator_id
  LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
  WHERE b.service_type = p_service_type
    AND b.is_countable_finding;

  v_donut_json := jsonb_build_object(
    'critical', COALESCE(v_critical_count, 0),
    'nonCritical', COALESCE(v_non_critical_count, 0),
    'total', COALESCE(v_critical_count, 0) + COALESCE(v_non_critical_count, 0)
  );

  WITH agent_stats AS (
    SELECT
      b.peserta_id,
      b.nama,
      b.batch_name,
      b.tim,
      b.jabatan,
      COUNT(*) FILTER (WHERE b.is_countable_finding) AS defects,
      BOOL_OR(b.nilai = 0 AND COALESCE(ri.category, i.category) = 'critical' AND b.is_phantom_padding = false) AS has_critical
    FROM temp_qa_range_base b
    LEFT JOIN qa_indicators i ON i.id = b.indicator_id
    LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
    WHERE b.service_type = p_service_type
    GROUP BY b.peserta_id, b.nama, b.batch_name, b.tim, b.jabatan
    HAVING COUNT(*) FILTER (WHERE b.is_phantom_padding = false) > 0
  ),
  agent_scored AS (
    SELECT
      peserta_id,
      nama,
      batch_name,
      tim,
      jabatan,
      defects,
      has_critical,
      qa_score_agent(peserta_id, v_period_ids, p_service_type, p_year) AS score
    FROM agent_stats
    ORDER BY defects DESC, nama ASC
    LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'agentId', peserta_id,
    'nama', nama,
    'batch', batch_name,
    'tim', tim,
    'jabatan', jabatan,
    'defects', defects,
    'score', ROUND(score::numeric, 2)::float,
    'hasCritical', COALESCE(has_critical, false)
  ) ORDER BY defects DESC, nama ASC), '[]'::jsonb)
  INTO v_top_agents_json
  FROM agent_scored;

  RETURN jsonb_build_object(
    'summary', v_summary_json,
    'paretoData', v_pareto_json,
    'serviceData', v_service_json,
    'donutData', v_donut_json,
    'topAgents', v_top_agents_json
  );
END;
$$;
