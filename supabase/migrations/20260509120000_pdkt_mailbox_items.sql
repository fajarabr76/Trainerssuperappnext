-- Migration: pdkt_mailbox_items
-- Created at: 2026-05-09 12:00:00

CREATE TABLE IF NOT EXISTS public.pdkt_mailbox_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'deleted')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    replied_at timestamptz,
    sender_name text NOT NULL,
    sender_email text NOT NULL,
    subject text,
    snippet text,
    scenario_snapshot jsonb NOT NULL,
    config_snapshot jsonb NOT NULL,
    inbound_email jsonb NOT NULL,
    emails_thread jsonb NOT NULL DEFAULT '[]'::jsonb,
    history_id uuid REFERENCES public.pdkt_history(id) ON DELETE SET NULL,
    last_activity_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_pdkt_mailbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_pdkt_mailbox_updated_at ON public.pdkt_mailbox_items;
CREATE TRIGGER tr_pdkt_mailbox_updated_at
    BEFORE UPDATE ON public.pdkt_mailbox_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_pdkt_mailbox_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdkt_mailbox_user_status_created 
    ON public.pdkt_mailbox_items (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pdkt_mailbox_history_id 
    ON public.pdkt_mailbox_items (history_id);

-- Enable RLS
ALTER TABLE public.pdkt_mailbox_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own mailbox items"
    ON public.pdkt_mailbox_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mailbox items"
    ON public.pdkt_mailbox_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mailbox items"
    ON public.pdkt_mailbox_items FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RPC for idempotent reply submission
CREATE OR REPLACE FUNCTION public.submit_pdkt_mailbox_reply(
    p_mailbox_id uuid,
    p_agent_reply jsonb,
    p_time_taken integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_item record;
    v_history_id uuid;
    v_updated_thread jsonb;
    v_now timestamptz;
BEGIN
    v_user_id := auth.uid();
    v_now := now();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Select and lock the mailbox item
    SELECT * INTO v_item
    FROM public.pdkt_mailbox_items
    WHERE id = p_mailbox_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mailbox item not found';
    END IF;

    IF v_item.status = 'replied' THEN
        RETURN v_item.history_id;
    END IF;

    IF v_item.status = 'deleted' THEN
        RAISE EXCEPTION 'Cannot reply to a deleted email';
    END IF;

    -- Prepare updated thread
    v_updated_thread := jsonb_build_array(v_item.inbound_email) || p_agent_reply;

    -- Insert into pdkt_history
    INSERT INTO public.pdkt_history (
        user_id,
        timestamp,
        config,
        emails,
        evaluation_status,
        time_taken
    ) VALUES (
        v_user_id,
        v_now,
        v_item.config_snapshot,
        v_updated_thread,
        'processing',
        p_time_taken
    ) RETURNING id INTO v_history_id;

    -- Update mailbox item
    UPDATE public.pdkt_mailbox_items
    SET 
        status = 'replied',
        replied_at = v_now,
        history_id = v_history_id,
        emails_thread = v_updated_thread,
        last_activity_at = v_now
    WHERE id = p_mailbox_id;

    RETURN v_history_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_pdkt_mailbox_reply(uuid, jsonb, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_pdkt_mailbox_reply(uuid, jsonb, integer) TO authenticated;
