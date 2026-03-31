-- =========================================================================
-- FUNCTION: qa_score_agent
-- =========================================================================
-- Replikasi fungsi Typescript `calculateQAScoreFromTemuan`
-- Digunakan untuk optimasi agregasi Dashboard QA via PostgreSQL (Server Size)
-- =========================================================================

CREATE OR REPLACE FUNCTION qa_score_agent(
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
BEGIN
  -- Handle edge case: jika agent tidak punya temuan sama sekali, return 100.0
  IF NOT EXISTS (
    SELECT 1 FROM qa_temuan 
    WHERE peserta_id = p_peserta_id
      AND period_id = ANY(p_period_ids)
      AND service_type = p_service_type
      AND tahun = p_year
  ) THEN
    RETURN 100.0;
  END IF;

  -- STEP 1 & STEP 2: Ambil semua temuan agent dan bentuk session_key per baris.
  -- Kita lakukan agregasi nilai/indicator per session_key ke dalam array agar pencarian (lookup) efisien.
  FOR v_session_records IN (
    WITH session_data AS (
      SELECT 
        indicator_id,
        nilai,
        CASE 
          WHEN no_tiket IS NOT NULL AND TRIM(no_tiket) != '' THEN TRIM(no_tiket)
          ELSE '__nt_' || ROW_NUMBER() OVER (ORDER BY created_at, id)::text
        END AS session_key
      FROM qa_temuan
      WHERE peserta_id = p_peserta_id
        AND period_id = ANY(p_period_ids)
        AND service_type = p_service_type
        AND tahun = p_year
    )
    SELECT 
      session_key, 
      array_agg(indicator_id::text) as ind_arr,
      array_agg(nilai) as val_arr
    FROM session_data
    GROUP BY session_key
  ) LOOP
    
    -- STEP 3: Score setiap session unik
    v_sum_nc_bobot := 0.0;
    v_sum_nc_earned := 0.0;
    v_sum_cr_bobot := 0.0;
    v_sum_cr_earned := 0.0;
    
    -- Ambil SEMUA indicator dari qa_indicators WHERE service_type = p_service_type
    FOR v_indicator IN (
      SELECT id::text AS id, category, bobot 
      FROM qa_indicators 
      WHERE service_type = p_service_type
    ) LOOP
      
      -- Cari apakah ada temuan untuk indicator ini di session ini
      v_nilai := 3; -- Jika tidak ada, default ke 3 (sempurna)
      v_idx := array_position(v_session_records.ind_arr, v_indicator.id);
      
      IF v_idx IS NOT NULL THEN
        v_nilai := v_session_records.val_arr[v_idx];
      END IF;
      
      -- Kalkulasi NC Score dan CR Score secara bertahap
      IF v_indicator.category = 'non_critical' THEN
        v_sum_nc_bobot := v_sum_nc_bobot + v_indicator.bobot;
        v_sum_nc_earned := v_sum_nc_earned + ((v_nilai::float / 3.0) * v_indicator.bobot);
      ELSIF v_indicator.category = 'critical' THEN
        v_sum_cr_bobot := v_sum_cr_bobot + v_indicator.bobot;
        v_sum_cr_earned := v_sum_cr_earned + ((v_nilai::float / 3.0) * v_indicator.bobot);
      END IF;
      
    END LOOP;
    
    -- Penyelesaian Kalkulasi NC Score
    IF v_sum_nc_bobot = 0.0 THEN
      v_nc_score := 100.0;
    ELSE
      v_nc_score := (v_sum_nc_earned / v_sum_nc_bobot) * 100.0;
    END IF;
    
    -- Penyelesaian Kalkulasi CR Score
    IF v_sum_cr_bobot = 0.0 THEN
      v_cr_score := 100.0;
    ELSE
      v_cr_score := (v_sum_cr_earned / v_sum_cr_bobot) * 100.0;
    END IF;
    
    -- Rata-rata session score
    v_session_score := (v_nc_score + v_cr_score) / 2.0;
    
    -- Kumpulkan semua session_score dalam sebuah array float
    v_session_scores := array_append(v_session_scores, v_session_score);
    
  END LOOP;
  
  -- STEP 4: Phantom Padding & Final Score
  
  -- Sort array ASCENDING (skor terburuk berada di depan)
  SELECT array_agg(s ORDER BY s ASC) INTO v_session_scores 
  FROM unnest(v_session_scores) s;
  
  -- Ambil maksimal 5 elemen pertama (MAX_SAMPLING = 5)
  v_session_scores := v_session_scores[1:5];
  
  -- Jika jumlah elemen < 5, tambahkan nilai 100.0 sampai total = 5 elemen
  WHILE array_length(v_session_scores, 1) IS NULL OR array_length(v_session_scores, 1) < 5 LOOP
    v_session_scores := array_append(v_session_scores, 100.0::float);
  END LOOP;
  
  -- final_score = SUM semua elemen array / 5.0
  SELECT SUM(s) / 5.0 INTO v_final_score 
  FROM unnest(v_session_scores) s;
  
  RETURN v_final_score;

END;
$$;

-- =========================================================================
-- FUNCTION: get_qa_dashboard_data
-- =========================================================================
-- Menggantikan getConsolidatedPeriodData di qaService.server.ts.
-- Semua agregasi dashboard di-run di database untuk performa maksimal.
-- =========================================================================

CREATE OR REPLACE FUNCTION get_qa_dashboard_data(
  p_period_ids  uuid[],
  p_service_type text,
  p_year        integer,
  p_folder_ids  text[]   -- array batch_name, bisa kosong []
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
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
  
  v_critical_count int := 0;
  v_non_critical_count int := 0;
  
  v_agent_id uuid;
  v_agent_score float;
  v_total_agent_score float := 0.0;
BEGIN
  DROP TABLE IF EXISTS temp_base;
  -- STEP 1: Base Data (Menggunakan TEMP TABLE untuk menggantikan CTE berulang)
  -- CTE tunggal tidak bisa dipakai multi-statement di PL/pgSQL, jadi kita tampung sementara
  CREATE TEMP TABLE temp_base ON COMMIT DROP AS
  SELECT 
    q.peserta_id, 
    q.indicator_id, 
    q.service_type, 
    q.no_tiket, 
    q.nilai, 
    p.nama, 
    p.batch_name, 
    p.tim
  FROM qa_temuan q
  JOIN profiler_peserta p ON q.peserta_id = p.id
  WHERE q.tahun = p_year
    AND q.period_id = ANY(p_period_ids)
    AND (array_length(p_folder_ids, 1) IS NULL 
         OR p.batch_name = ANY(p_folder_ids));

  -- STEP 2: Summary (hanya untuk p_service_type)
  SELECT 
    COUNT(DISTINCT peserta_id),
    COUNT(*) FILTER (WHERE nilai < 3)
  INTO v_total_agents, v_total_defects
  FROM temp_base
  WHERE service_type = p_service_type;

  v_avg_defects := v_total_defects::float / NULLIF(v_total_agents, 0);

  -- zero_error_count = COUNT peserta_id yang tidak punya temuan dengan nilai < 3
  SELECT COUNT(DISTINCT peserta_id) INTO v_zero_error_count
  FROM temp_base
  WHERE service_type = p_service_type
  AND NOT EXISTS (
    SELECT 1 FROM temp_base t2
    WHERE t2.peserta_id = temp_base.peserta_id
      AND t2.service_type = p_service_type
      AND t2.nilai < 3
  );

  v_zero_error_rate := (v_zero_error_count::float / NULLIF(v_total_agents, 0)) * 100.0;

  -- Loop setiap distinct peserta_id, panggil qa_score_agent() untuk mendapatkan score.
  v_total_agent_score := 0.0;
  v_compliance_count := 0;

  FOR v_agent_id IN (
    SELECT DISTINCT peserta_id 
    FROM temp_base 
    WHERE service_type = p_service_type
  ) LOOP
    v_agent_score := qa_score_agent(v_agent_id, p_period_ids, p_service_type, p_year);
    v_total_agent_score := v_total_agent_score + v_agent_score;
    
    IF v_agent_score >= 95.0 THEN
      v_compliance_count := v_compliance_count + 1;
    END IF;
  END LOOP;
  
  v_avg_agent_score := v_total_agent_score / NULLIF(v_total_agents, 0);
  v_compliance_rate := (v_compliance_count::float / NULLIF(v_total_agents, 0)) * 100.0;
  
  -- Bentuk JSON untuk summary (Key JSON PERSIS seperti TypeScript Interface)
  v_summary_json := jsonb_build_object(
    'totalDefects', COALESCE(v_total_defects, 0),
    'avgDefectsPerAudit', ROUND(COALESCE(v_avg_defects, 0.0)::numeric, 2)::float,
    'zeroErrorRate', ROUND(COALESCE(v_zero_error_rate, 0.0)::numeric, 2)::float,
    'avgAgentScore', ROUND(COALESCE(v_avg_agent_score, 0.0)::numeric, 2)::float,
    'complianceRate', ROUND(COALESCE(v_compliance_rate, 0.0)::numeric, 2)::float,
    'complianceCount', COALESCE(v_compliance_count, 0),
    'totalAgents', COALESCE(v_total_agents, 0)
  );

  -- STEP 3: Pareto (hanya untuk p_service_type, hanya nilai < 3)
  WITH pareto_counts AS (
    SELECT 
      i.name AS param_name,
      i.category,
      COUNT(*) AS count_defects
    FROM temp_base b
    JOIN qa_indicators i ON b.indicator_id = i.id
    WHERE b.service_type = p_service_type AND b.nilai < 3
    GROUP BY i.id, i.name, i.category
    ORDER BY count_defects DESC, param_name ASC
  ),
  pareto_cumulative AS (
    SELECT 
      param_name,
      category,
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
      'category', category
    ) ORDER BY count_defects DESC, param_name ASC
  ), '[]'::jsonb) INTO v_pareto_json
  FROM pareto_cumulative;

  -- STEP 4: Service Comparison (semua service_type dari base)
  WITH svc_summary AS (
    SELECT 
      service_type,
      COUNT(DISTINCT peserta_id) AS s_agents,
      COUNT(*) FILTER (WHERE nilai < 3) AS s_defects
    FROM temp_base
    GROUP BY service_type
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', CASE service_type
                WHEN 'call' THEN 'Layanan Call'
                WHEN 'chat' THEN 'Layanan Chat'
                WHEN 'email' THEN 'Layanan Email'
                WHEN 'cso' THEN 'Layanan CSO'
                WHEN 'pencatatan' THEN 'Pencatatan'
                WHEN 'bko' THEN 'BKO'
                WHEN 'slik' THEN 'SLIK'
                ELSE service_type
              END,
      'serviceType', service_type,
      'total', s_defects,
      'severity', CASE 
                    WHEN s_defects > 50 THEN 'Critical'
                    WHEN s_defects > 30 THEN 'High'
                    WHEN s_defects > 15 THEN 'Medium'
                    ELSE 'Low'
                  END
    )
  ), '[]'::jsonb) INTO v_service_json
  FROM svc_summary;

  -- STEP 5: Donut (hanya p_service_type, hanya nilai < 3)
  SELECT 
    COUNT(*) FILTER (WHERE i.category = 'critical'),
    COUNT(*) FILTER (WHERE i.category = 'non_critical')
  INTO v_critical_count, v_non_critical_count
  FROM temp_base b
  JOIN qa_indicators i ON b.indicator_id = i.id
  WHERE b.service_type = p_service_type AND b.nilai < 3;

  v_donut_json := jsonb_build_object(
    'critical', COALESCE(v_critical_count, 0),
    'nonCritical', COALESCE(v_non_critical_count, 0),
    'total', COALESCE(v_critical_count, 0) + COALESCE(v_non_critical_count, 0)
  );

  -- STEP 6: Top Agents (hanya p_service_type, top 5 by defects)
  WITH agent_stats AS (
    SELECT 
      b.peserta_id,
      b.nama,
      b.batch_name,
      COUNT(*) FILTER (WHERE b.nilai < 3) AS defects,
      BOOL_OR(b.nilai = 0 AND i.category = 'critical') AS has_critical
    FROM temp_base b
    LEFT JOIN qa_indicators i ON b.indicator_id = i.id
    WHERE b.service_type = p_service_type
    GROUP BY b.peserta_id, b.nama, b.batch_name
  ),
  agent_scored AS (
    SELECT 
      peserta_id,
      nama,
      batch_name,
      defects,
      has_critical,
      qa_score_agent(peserta_id, p_period_ids, p_service_type, p_year) AS score
    FROM agent_stats
    ORDER BY defects DESC
    LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'agentId', peserta_id,
      'nama', nama,
      'batch', batch_name,
      'defects', defects,
      'score', ROUND(score::numeric, 2)::float,
      'hasCritical', COALESCE(has_critical, false)
    )
  ), '[]'::jsonb) INTO v_top_agents_json
  FROM agent_scored;

  -- Bersihkan temp table
  DROP TABLE IF EXISTS temp_base;

  -- STEP 7: Return semua sebagai JSONB
  RETURN jsonb_build_object(
    'summary', v_summary_json,
    'paretoData', v_pareto_json,
    'serviceData', v_service_json,
    'donutData', v_donut_json,
    'topAgents', v_top_agents_json
  );
END;
$$;

