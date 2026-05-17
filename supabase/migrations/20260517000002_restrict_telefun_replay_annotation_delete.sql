-- Security hardening: remove direct client DELETE access from Telefun replay annotations.
--
-- AI-generated replay annotations are maintained by server actions through
-- createAdminClient(). Browser clients may read their own rows and insert manual
-- annotations, but they must not delete generated rows through the Data API.

DROP POLICY IF EXISTS "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations;

REVOKE DELETE ON public.telefun_replay_annotations FROM authenticated;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must not have direct DELETE on telefun_replay_annotations';
  END IF;
END;
$$;

COMMENT ON TABLE public.telefun_replay_annotations IS
  'AI-generated and manual annotations for Telefun session replay. Browser clients may read owned rows and insert manual annotations; generated annotation cleanup is server-only.';
