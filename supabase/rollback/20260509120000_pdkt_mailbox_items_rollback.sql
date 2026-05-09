-- Rollback: pdkt_mailbox_items
-- Created at: 2026-05-09 12:00:00

DROP FUNCTION IF EXISTS public.submit_pdkt_mailbox_reply(uuid, jsonb, integer);
DROP TABLE IF EXISTS public.pdkt_mailbox_items;
