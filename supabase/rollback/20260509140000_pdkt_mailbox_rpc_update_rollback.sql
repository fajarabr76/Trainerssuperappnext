-- Rollback: PDKT Mailbox RPC and Template Updates
-- Date: 2026-05-09

-- Revert submit_pdkt_mailbox_batch to return void and throw on duplicate
DROP FUNCTION IF EXISTS public.submit_pdkt_mailbox_batch(text, text, text, text, text, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.submit_pdkt_mailbox_batch(
    p_client_request_id text,
    p_sender_name text,
    p_sender_email text,
    p_subject text,
    p_snippet text,
    p_scenario_snapshot jsonb,
    p_config_snapshot jsonb,
    p_inbound_email jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_creator_id uuid;
    v_creator_role text;
    v_batch_id uuid;
    v_source_item_id uuid;
    v_duplicate_exists boolean;
BEGIN
    v_creator_id := auth.uid();
    v_batch_id := gen_random_uuid();
    
    IF v_creator_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get creator role (normalized check)
    SELECT role INTO v_creator_role FROM public.profiles WHERE id = v_creator_id;

    -- Strict idempotency guard: reject duplicate client request ids per creator
    IF p_client_request_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.pdkt_mailbox_items
            WHERE created_by_user_id = v_creator_id
              AND client_request_id = p_client_request_id
        ) INTO v_duplicate_exists;

        IF v_duplicate_exists THEN
            RAISE EXCEPTION 'Duplicate mailbox request';
        END IF;
    END IF;

    -- 1. Insert for the creator
    INSERT INTO public.pdkt_mailbox_items (
        user_id,
        created_by_user_id,
        client_request_id,
        share_batch_id,
        sender_name,
        sender_email,
        subject,
        snippet,
        scenario_snapshot,
        config_snapshot,
        inbound_email,
        emails_thread,
        status,
        is_shared_copy
    ) VALUES (
        v_creator_id,
        v_creator_id,
        p_client_request_id,
        v_batch_id,
        p_sender_name,
        p_sender_email,
        p_subject,
        p_snippet,
        p_scenario_snapshot,
        p_config_snapshot,
        p_inbound_email,
        jsonb_build_array(p_inbound_email),
        'open',
        false
    ) RETURNING id INTO v_source_item_id;

    -- 2. Fan out if Admin/Trainer
    IF LOWER(TRIM(v_creator_role)) IN ('admin', 'trainer', 'trainers') THEN
        INSERT INTO public.pdkt_mailbox_items (
            user_id,
            created_by_user_id,
            source_mailbox_item_id,
            share_batch_id,
            client_request_id,
            sender_name,
            sender_email,
            subject,
            snippet,
            scenario_snapshot,
            config_snapshot,
            inbound_email,
            emails_thread,
            status,
            is_shared_copy,
            shared_at
        )
        SELECT 
            p.id,
            v_creator_id,
            v_source_item_id,
            v_batch_id,
            p_client_request_id,
            p_sender_name,
            p_sender_email,
            p_subject,
            p_snippet,
            p_scenario_snapshot,
            p_config_snapshot,
            p_inbound_email,
            jsonb_build_array(p_inbound_email),
            'open',
            true,
            now()
        FROM public.profiles p
        WHERE p.id != v_creator_id
          AND p.status = 'approved'
          AND p.is_deleted = false
          AND LOWER(TRIM(p.role)) IN ('leader', 'agent', 'agents', 'leaders')
        ;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_pdkt_mailbox_batch(text, text, text, text, text, jsonb, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_pdkt_mailbox_batch(text, text, text, text, text, jsonb, jsonb, jsonb) TO authenticated;
