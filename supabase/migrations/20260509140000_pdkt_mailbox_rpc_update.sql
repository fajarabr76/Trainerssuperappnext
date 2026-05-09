-- Update submit_pdkt_mailbox_batch to return ID and handle idempotency gracefully
-- Date: 2026-05-09

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
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_creator_id uuid;
    v_creator_role text;
    v_batch_id uuid;
    v_source_item_id uuid;
    v_existing_id uuid;
BEGIN
    v_creator_id := auth.uid();
    v_batch_id := gen_random_uuid();
    
    IF v_creator_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get creator role (normalized check)
    SELECT role INTO v_creator_role FROM public.profiles WHERE id = v_creator_id;

    -- Idempotency check: if duplicate exists, return the existing ID
    IF p_client_request_id IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.pdkt_mailbox_items
        WHERE created_by_user_id = v_creator_id
          AND client_request_id = p_client_request_id
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
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

    RETURN v_source_item_id;
END;
$$;
