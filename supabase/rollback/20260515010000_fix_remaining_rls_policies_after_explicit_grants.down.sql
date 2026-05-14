-- =============================================================================
-- Rollback: Fix Remaining RLS Policies After Explicit Grants
-- =============================================================================
-- Drops all policies and helper functions created by migration 20260515010000.
-- =============================================================================

-- 1. activity_logs
DROP POLICY IF EXISTS "All authenticated can insert activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Trainers can view activities" ON public.activity_logs;
DROP POLICY IF EXISTS "Trainers can delete activities" ON public.activity_logs;

-- 2. ketik_history
DROP POLICY IF EXISTS "Users can view own ketik history" ON public.ketik_history;
DROP POLICY IF EXISTS "Users can insert own ketik history" ON public.ketik_history;
DROP POLICY IF EXISTS "Users can update own ketik history" ON public.ketik_history;
DROP POLICY IF EXISTS "Users can delete own ketik history" ON public.ketik_history;
DROP POLICY IF EXISTS "Service role full access ketik history" ON public.ketik_history;

-- 3. pdkt_history
DROP POLICY IF EXISTS "Users can view own pdkt history" ON public.pdkt_history;
DROP POLICY IF EXISTS "Users can insert own pdkt history" ON public.pdkt_history;
DROP POLICY IF EXISTS "Users can update own pdkt history" ON public.pdkt_history;
DROP POLICY IF EXISTS "Users can delete own pdkt history" ON public.pdkt_history;
DROP POLICY IF EXISTS "Service role full access pdkt history" ON public.pdkt_history;

-- 4. user_settings
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;

-- 5. profiler tables
DROP POLICY IF EXISTS "Trainers can manage profiler_years" ON public.profiler_years;
DROP POLICY IF EXISTS "Leaders can view profiler_years" ON public.profiler_years;
DROP POLICY IF EXISTS "Trainers can manage profiler_folders" ON public.profiler_folders;
DROP POLICY IF EXISTS "Leaders can view profiler_folders" ON public.profiler_folders;
DROP POLICY IF EXISTS "Trainers can manage profiler_tim_list" ON public.profiler_tim_list;
DROP POLICY IF EXISTS "Leaders can view profiler_tim_list" ON public.profiler_tim_list;
DROP POLICY IF EXISTS "Trainers can manage profiler_peserta" ON public.profiler_peserta;
DROP POLICY IF EXISTS "Leaders can view profiler_peserta" ON public.profiler_peserta;

-- 6. qa_periods
DROP POLICY IF EXISTS "All authenticated can read qa_periods" ON public.qa_periods;
DROP POLICY IF EXISTS "Trainers can insert qa_periods" ON public.qa_periods;
DROP POLICY IF EXISTS "Trainers can update qa_periods" ON public.qa_periods;
DROP POLICY IF EXISTS "Trainers can delete qa_periods" ON public.qa_periods;

-- 7. qa_indicators
DROP POLICY IF EXISTS "All authenticated can read qa_indicators" ON public.qa_indicators;
DROP POLICY IF EXISTS "Trainers can insert qa_indicators" ON public.qa_indicators;
DROP POLICY IF EXISTS "Trainers can update qa_indicators" ON public.qa_indicators;
DROP POLICY IF EXISTS "Trainers can delete qa_indicators" ON public.qa_indicators;

-- 8. qa_temuan
DROP POLICY IF EXISTS "Trainers can manage qa_temuan" ON public.qa_temuan;
DROP POLICY IF EXISTS "Leaders can view qa_temuan" ON public.qa_temuan;
DROP POLICY IF EXISTS "Agents can view own qa_temuan" ON public.qa_temuan;

-- 9. Helper functions (drop last, policies reference them)
DROP FUNCTION IF EXISTS public.leader_can_access_sidak_temuan(uuid, text);
DROP FUNCTION IF EXISTS public.leader_can_access_peserta(uuid, text);
DROP FUNCTION IF EXISTS public.leader_has_scope_value(text, text, text);
