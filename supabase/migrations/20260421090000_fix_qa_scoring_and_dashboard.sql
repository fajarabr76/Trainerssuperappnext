-- Fix QA scoring logic to support versioned rule indicators and exclude phantom padding from real session counts.
-- Also ensures dashboard aggregates are consistent with versioned rules.

-- 1. Update qa_score_agent to use versioned rule indicators and handle phantom padding
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
  
  v_rule_version_id uuid;
  v_scoring_mode text;
  v_critical_weight numeric;
  v_non_critical_weight numeric;
BEGIN
  -- Handle edge case: jika agent tidak punya data audit sama sekali, return 100.0
  IF NOT EXISTS (
    SELECT 1 FROM qa_temuan 
    WHERE peserta_id = p_peserta_id
      AND period_id = ANY(p_period_ids)
      AND service_type = p_service_type
      AND tahun = p_year
      AND is_phantom_padding = false
  ) THEN
    RETURN 100.0;
  END IF;

  -- Step 1: Agregasi temuan per sesi (no_tiket atau generated key)
  FOR v_session_records IN (
    WITH session_data AS (
      SELECT 
        COALESCE(rule_indicator_id, indicator_id) as any_indicator_id,
        rule_version_id,
        nilai,
        CASE 
          WHEN no_tiket IS NOT NULL AND TRIM(no_tiket) != '' THEN TRIM(no_tiket)
          ELSE '__nt_' || TO_CHAR(created_at, 'YYYYMMDD_HH24MISS')
        END AS session_key
      FROM qa_temuan
      WHERE peserta_id = p_peserta_id
        AND period_id = ANY(p_period_ids)
        AND service_type = p_service_type
        AND tahun = p_year
        AND is_phantom_padding = false
    )
    SELECT 
      session_key, 
      MAX(rule_version_id) as v_rule_id,
      array_agg(any_indicator_id::text) as ind_arr,
      array_agg(nilai) as val_arr
    FROM session_data
    GROUP BY session_key
  ) LOOP
    
    -- Step 2: Ambil metadata versi (weights & mode)
    IF v_session_records.v_rule_id IS NOT NULL THEN
       SELECT scoring_mode, critical_weight, non_critical_weight 
       INTO v_scoring_mode, v_critical_weight, v_non_critical_weight
       FROM qa_service_rule_versions WHERE id = v_session_records.v_rule_id;
    ELSE
       SELECT scoring_mode, critical_weight, non_critical_weight 
       INTO v_scoring_mode, v_critical_weight, v_non_critical_weight
       FROM qa_service_weights WHERE service_type = p_service_type;
    END IF;
    
    -- Fallbacks
    v_scoring_mode := COALESCE(v_scoring_mode, 'weighted');
    v_critical_weight := COALESCE(v_critical_weight, 0.5);
    v_non_critical_weight := COALESCE(v_non_critical_weight, 0.5);

    -- Step 3: Hitung skor sesi
    v_sum_nc_bobot := 0.0; v_sum_nc_earned := 0.0;
    v_sum_cr_bobot := 0.0; v_sum_cr_earned := 0.0;
    
    IF v_session_records.v_rule_id IS NOT NULL THEN
      FOR v_indicator IN (
        SELECT id::text AS id, category, bobot 
        FROM qa_service_rule_indicators 
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
        SELECT id::text AS id, category, bobot 
        FROM qa_indicators 
        WHERE service_type = p_service_type
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
    
    -- Hitung NC & CR Scores
    IF v_scoring_mode = 'flat' OR v_scoring_mode = 'no_category' THEN
       IF (v_sum_nc_bobot + v_sum_cr_bobot) = 0 THEN v_session_score := 100.0;
       ELSE v_session_score := ((v_sum_nc_earned + v_sum_cr_earned) / (v_sum_nc_bobot + v_sum_cr_bobot)) * 100.0; END IF;
    ELSE
       IF v_sum_nc_bobot = 0.0 THEN v_nc_score := 100.0; ELSE v_nc_score := (v_sum_nc_earned / v_sum_nc_bobot) * 100.0; END IF;
       IF v_sum_cr_bobot = 0.0 THEN v_cr_score := 100.0; ELSE v_cr_score := (v_sum_cr_earned / v_sum_cr_bobot) * 100.0; END IF;
       v_session_score := (v_nc_score * v_non_critical_weight) + (v_cr_score * v_critical_weight);
    END IF;
    
    v_session_scores := array_append(v_session_scores, v_session_score::float);
  END LOOP;
  
  -- Step 4: Sampling & Padding (MAX_SAMPLING = 5)
  SELECT array_agg(s ORDER BY s ASC) INTO v_session_scores FROM unnest(v_session_scores) s;
  v_session_scores := v_session_scores[1:5];
  WHILE array_length(v_session_scores, 1) IS NULL OR array_length(v_session_scores, 1) < 5 LOOP
    v_session_scores := array_append(v_session_scores, 100.0::float);
  END LOOP;
  
  SELECT SUM(s) / 5.0 INTO v_final_score FROM unnest(v_session_scores) s;
  RETURN v_final_score;
END;
$$;

-- 2. Update get_qa_dashboard_range_data to ensure agents without real audits are not counted
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

  -- Only count agents who have at least one real (non-phantom) record in this service
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

  -- Pareto & Donut logic (updated to use COALESCE(rule_indicator_id, indicator_id))
  WITH pareto_counts AS (
    SELECT
      COALESCE(ri.name, i.name) AS param_name,
      COALESCE(ri.category, i.category) as category,
      COUNT(*) AS count_defects
    FROM temp_qa_range_base b
    LEFT JOIN qa_indicators i ON i.id = b.indicator_id
    LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
    WHERE b.service_type = p_service_type
      AND b.is_countable_finding
    GROUP BY param_name, category
  ),
  pareto_cumulative AS (
    SELECT
      param_name, category, count_defects,
      SUM(count_defects) OVER (ORDER BY count_defects DESC, param_name ASC) AS running_total,
      SUM(count_defects) OVER () AS overall_total
    FROM pareto_counts
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', param_name, 'fullName', param_name, 'count', count_defects,
      'cumulative', ROUND(((running_total::float / NULLIF(overall_total, 0)) * 100.0)::numeric, 1)::float,
      'category', category
    ) ORDER BY count_defects DESC, param_name ASC
  ), '[]'::jsonb) INTO v_pareto_json FROM pareto_cumulative;

  -- Service Summary
  WITH service_summary AS (
    SELECT service_type, COUNT(*) FILTER (WHERE is_countable_finding) AS total_defects
    FROM temp_qa_range_base GROUP BY service_type
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', CASE service_type WHEN 'call' THEN 'Layanan Call' WHEN 'chat' THEN 'Layanan Chat' WHEN 'email' THEN 'Layanan Email' WHEN 'cso' THEN 'Layanan CSO' WHEN 'pencatatan' THEN 'Pencatatan' WHEN 'bko' THEN 'BKO' WHEN 'slik' THEN 'SLIK' ELSE service_type END,
    'serviceType', service_type, 'total', total_defects,
    'severity', CASE WHEN total_defects > 50 THEN 'Critical' WHEN total_defects > 30 THEN 'High' WHEN total_defects > 15 THEN 'Medium' ELSE 'Low' END
  )), '[]'::jsonb) INTO v_service_json FROM service_summary;

  -- Donut
  SELECT
    COUNT(*) FILTER (WHERE COALESCE(ri.category, i.category) = 'critical'),
    COUNT(*) FILTER (WHERE COALESCE(ri.category, i.category) = 'non_critical')
  INTO v_critical_count, v_non_critical_count
  FROM temp_qa_range_base b
  LEFT JOIN qa_indicators i ON i.id = b.indicator_id
  LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
  WHERE b.service_type = p_service_type AND b.is_countable_finding;

  v_donut_json := jsonb_build_object(
    'critical', COALESCE(v_critical_count, 0),
    'nonCritical', COALESCE(v_non_critical_count, 0),
    'total', COALESCE(v_critical_count, 0) + COALESCE(v_non_critical_count, 0)
  );

  -- Top Agents
  WITH agent_stats AS (
    SELECT
      b.peserta_id, b.nama, b.batch_name, b.tim, b.jabatan,
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
    SELECT peserta_id, nama, batch_name, tim, jabatan, defects, has_critical,
      qa_score_agent(peserta_id, v_period_ids, p_service_type, p_year) AS score
    FROM agent_stats ORDER BY defects DESC, nama ASC LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'agentId', peserta_id, 'nama', nama, 'batch', batch_name, 'tim', tim, 'jabatan', jabatan,
      'defects', defects, 'score', ROUND(score::numeric, 2)::float, 'hasCritical', COALESCE(has_critical, false)
  ) ORDER BY defects DESC, nama ASC), '[]'::jsonb) INTO v_top_agents_json FROM agent_scored;

  RETURN jsonb_build_object(
    'summary', v_summary_json, 'paretoData', v_pareto_json, 'serviceData', v_service_json,
    'donutData', v_donut_json, 'topAgents', v_top_agents_json
  );
END;
$$;

-- 3. Update get_qa_dashboard_range_trend_data to handle versioned rules and phantom padding correctly
CREATE OR REPLACE FUNCTION public.get_qa_dashboard_range_trend_data(
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
  v_period record;
  v_labels text[] := '{}';
  v_total_json jsonb := '[]'::jsonb;
  v_avg_json jsonb := '[]'::jsonb;
  v_zero_json jsonb := '[]'::jsonb;
  v_compliance_json jsonb := '[]'::jsonb;
  v_avg_score_json jsonb := '[]'::jsonb;
  v_total_findings int;
  v_total_audited int;
  v_zero_count int;
  v_pass_count int;
  v_avg_agent_score float;
  v_total_agent_score float;
  v_agent_id uuid;
  v_agent_score float;
  v_param_trend jsonb;
BEGIN
  DROP TABLE IF EXISTS temp_qa_range_trend_periods;
  CREATE TEMP TABLE temp_qa_range_trend_periods ON COMMIT DROP AS
  SELECT id, month, year
  FROM qa_periods
  WHERE year = p_year
    AND month BETWEEN p_start_month AND p_end_month
  ORDER BY month ASC;

  IF NOT EXISTS (SELECT 1 FROM temp_qa_range_trend_periods) THEN
    RETURN jsonb_build_object(
      'sparklines', jsonb_build_object(),
      'paramTrend', jsonb_build_object('labels', '[]'::jsonb, 'datasets', '[]'::jsonb)
    );
  END IF;

  DROP TABLE IF EXISTS temp_qa_range_trend_base;
  CREATE TEMP TABLE temp_qa_range_trend_base ON COMMIT DROP AS
  SELECT
    q.peserta_id,
    q.indicator_id,
    q.rule_indicator_id,
    q.service_type,
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
    p.batch_name
  FROM qa_temuan q
  JOIN profiler_peserta p ON p.id = q.peserta_id
  WHERE q.tahun = p_year
    AND q.period_id IN (SELECT id FROM temp_qa_range_trend_periods)
    AND q.service_type = p_service_type
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

  FOR v_period IN
    SELECT id, month, year
    FROM temp_qa_range_trend_periods
    ORDER BY month ASC
  LOOP
    v_labels := array_append(v_labels, to_char(make_date(v_period.year, v_period.month, 1), 'Mon YY'));

    SELECT 
      COUNT(*) FILTER (WHERE is_countable_finding), 
      COUNT(DISTINCT peserta_id) FILTER (WHERE is_phantom_padding = false)
    INTO v_total_findings, v_total_audited
    FROM temp_qa_range_trend_base
    WHERE period_id = v_period.id;

    SELECT COUNT(DISTINCT b.peserta_id)
    INTO v_zero_count
    FROM temp_qa_range_trend_base b
    WHERE b.period_id = v_period.id
      AND b.is_phantom_padding = false
      AND NOT EXISTS (
        SELECT 1
        FROM temp_qa_range_trend_base b2
        WHERE b2.period_id = b.period_id
          AND b2.peserta_id = b.peserta_id
          AND b2.is_phantom_padding = false
          AND b2.nilai < 3
      );

    v_pass_count := 0;
    v_total_agent_score := 0.0;

    FOR v_agent_id IN
      SELECT DISTINCT peserta_id
      FROM temp_qa_range_trend_base
      WHERE period_id = v_period.id
        AND is_phantom_padding = false
    LOOP
      v_agent_score := qa_score_agent(v_agent_id, ARRAY[v_period.id]::uuid[], p_service_type, p_year);
      v_total_agent_score := v_total_agent_score + v_agent_score;
      IF v_agent_score >= 95.0 THEN
        v_pass_count := v_pass_count + 1;
      END IF;
    END LOOP;

    v_avg_agent_score := v_total_agent_score / NULLIF(v_total_audited, 0);

    v_total_json := v_total_json || jsonb_build_array(jsonb_build_object(
      'label', to_char(make_date(v_period.year, v_period.month, 1), 'Mon YY'),
      'value', COALESCE(v_total_findings, 0)
    ));

    v_avg_json := v_avg_json || jsonb_build_array(jsonb_build_object(
      'label', to_char(make_date(v_period.year, v_period.month, 1), 'Mon YY'),
      'value', ROUND(COALESCE((v_total_findings::float / NULLIF(v_total_audited, 0)), 0)::numeric, 1)::float
    ));

    v_zero_json := v_zero_json || jsonb_build_array(jsonb_build_object(
      'label', to_char(make_date(v_period.year, v_period.month, 1), 'Mon YY'),
      'value', ROUND(COALESCE(((v_zero_count::float / NULLIF(v_total_audited, 0)) * 100.0), 0)::numeric, 1)::float
    ));

    v_compliance_json := v_compliance_json || jsonb_build_array(jsonb_build_object(
      'label', to_char(make_date(v_period.year, v_period.month, 1), 'Mon YY'),
      'value', COALESCE(v_pass_count, 0)
    ));

    v_avg_score_json := v_avg_score_json || jsonb_build_array(jsonb_build_object(
      'label', to_char(make_date(v_period.year, v_period.month, 1), 'Mon YY'),
      'value', ROUND(COALESCE(v_avg_agent_score, 0)::numeric, 1)::float
    ));
  END LOOP;

  WITH param_counts AS (
    SELECT
      COALESCE(ri.name, i.name) AS param_name,
      b.period_id,
      COUNT(*) AS total_count
    FROM temp_qa_range_trend_base b
    LEFT JOIN qa_indicators i ON i.id = b.indicator_id
    LEFT JOIN qa_service_rule_indicators ri ON ri.id = b.rule_indicator_id
    WHERE b.is_countable_finding
    GROUP BY param_name, b.period_id
  ),
  param_totals AS (
    SELECT param_name, SUM(total_count) AS grand_total
    FROM param_counts
    GROUP BY param_name
    ORDER BY grand_total DESC, param_name ASC
  ),
  period_totals AS (
    SELECT period_id, COUNT(*) FILTER (WHERE is_countable_finding) AS total_count
    FROM temp_qa_range_trend_base
    GROUP BY period_id
  ),
  period_labels AS (
    SELECT id, month, to_char(make_date(year, month, 1), 'Mon YY') AS label
    FROM temp_qa_range_trend_periods
  ),
  top_params AS (
    SELECT param_name
    FROM param_totals
    ORDER BY grand_total DESC, param_name ASC
    LIMIT 10
  ),
  param_datasets AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'label', tp.param_name,
        'data', (
          SELECT jsonb_agg(COALESCE(pc.total_count, 0) ORDER BY pl.month)
          FROM period_labels pl
          LEFT JOIN param_counts pc
            ON pc.period_id = pl.id
           AND pc.param_name = tp.param_name
        ),
        'isTotal', false
      )
      ORDER BY tp.param_name
    ) AS datasets
    FROM top_params tp
  )
  SELECT jsonb_build_object(
    'labels', to_jsonb(v_labels),
    'datasets',
      COALESCE(
        jsonb_build_array(
          jsonb_build_object(
            'label', 'Total Temuan',
            'data', (
              SELECT jsonb_agg(COALESCE(pt.total_count, 0) ORDER BY pl.month)
              FROM period_labels pl
              LEFT JOIN period_totals pt ON pt.period_id = pl.id
            ),
            'isTotal', true
          )
        ) || COALESCE((SELECT datasets FROM param_datasets), '[]'::jsonb),
        '[]'::jsonb
      )
  )
  INTO v_param_trend;

  RETURN jsonb_build_object(
    'sparklines', jsonb_build_object(
      'total', v_total_json,
      'avg', v_avg_json,
      'zero', v_zero_json,
      'compliance', v_compliance_json,
      'avgAgentScore', v_avg_score_json
    ),
    'paramTrend', COALESCE(v_param_trend, jsonb_build_object('labels', '[]'::jsonb, 'datasets', '[]'::jsonb))
  );
END;
$$;

