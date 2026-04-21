-- ① Create qa_service_rule_versions table
CREATE TABLE IF NOT EXISTS public.qa_service_rule_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type        text NOT NULL,
  effective_period_id uuid NOT NULL REFERENCES public.qa_periods(id),
  status              text NOT NULL CHECK (status IN ('draft', 'published')),
  critical_weight     numeric NOT NULL DEFAULT 0.5,
  non_critical_weight numeric NOT NULL DEFAULT 0.5,
  scoring_mode        text NOT NULL DEFAULT 'weighted' CHECK (scoring_mode IN ('weighted', 'flat', 'no_category')),
  created_by          uuid REFERENCES auth.users(id),
  published_by        uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  published_at        timestamptz,

  CONSTRAINT weights_sum_check_v
    CHECK (ABS(critical_weight + non_critical_weight - 1.0) < 0.001)
);

-- ② Create qa_service_rule_indicators table
CREATE TABLE IF NOT EXISTS public.qa_service_rule_indicators (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id     uuid NOT NULL REFERENCES public.qa_service_rule_versions(id) ON DELETE CASCADE,
  legacy_indicator_id uuid, -- For reference to current indicators during migration
  name                text NOT NULL,
  category            text NOT NULL CHECK (category IN ('critical', 'non_critical', 'none')),
  bobot               numeric NOT NULL,
  has_na              boolean NOT NULL DEFAULT false,
  threshold           numeric,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ③ Add references to qa_temuan
ALTER TABLE public.qa_temuan
  ADD COLUMN IF NOT EXISTS rule_version_id uuid REFERENCES public.qa_service_rule_versions(id),
  ADD COLUMN IF NOT EXISTS rule_indicator_id uuid REFERENCES public.qa_service_rule_indicators(id);

-- ④ Backfill baseline rules
DO $$
DECLARE
  earliest_period_id uuid;
  svc_row record;
  new_version_id uuid;
BEGIN
  -- Find earliest period
  SELECT id INTO earliest_period_id FROM public.qa_periods ORDER BY year ASC, month ASC LIMIT 1;

  IF earliest_period_id IS NOT NULL THEN
    -- Iterate through current weights
    FOR svc_row IN SELECT * FROM public.qa_service_weights LOOP
      -- Insert into rule_versions
      INSERT INTO public.qa_service_rule_versions 
        (service_type, effective_period_id, status, critical_weight, non_critical_weight, scoring_mode, published_at)
      VALUES 
        (svc_row.service_type, earliest_period_id, 'published', svc_row.critical_weight, svc_row.non_critical_weight, svc_row.scoring_mode, now())
      RETURNING id INTO new_version_id;

      -- Insert indicators for this version
      INSERT INTO public.qa_service_rule_indicators 
        (rule_version_id, legacy_indicator_id, name, category, bobot, has_na, threshold)
      SELECT 
        new_version_id, id, name, category, bobot, has_na, null
      FROM public.qa_indicators
      WHERE service_type = svc_row.service_type;

      -- Update findings
      UPDATE public.qa_temuan t
      SET 
        rule_version_id = new_version_id,
        rule_indicator_id = i.id
      FROM public.qa_service_rule_indicators i
      WHERE t.service_type = svc_row.service_type
        AND t.indicator_id = i.legacy_indicator_id
        AND i.rule_version_id = new_version_id;
    END LOOP;
  END IF;
END $$;

-- ⑤ RLS
ALTER TABLE public.qa_service_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_service_rule_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules_read_all" ON public.qa_service_rule_versions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rules_write_auth" ON public.qa_service_rule_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer', 'trainers')
    )
  );

CREATE POLICY "indicators_read_all" ON public.qa_service_rule_indicators
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "indicators_write_auth" ON public.qa_service_rule_indicators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer', 'trainers')
    )
  );
