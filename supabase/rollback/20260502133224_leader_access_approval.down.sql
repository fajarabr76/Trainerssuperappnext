-- Rollback: Leader Access Approval tables and policies

drop function if exists public.get_leader_approved_scope_items(uuid, text);

drop policy if exists "Leader views own request groups" on public.leader_access_request_groups;
drop policy if exists "Admin and trainer manage access request groups" on public.leader_access_request_groups;
drop policy if exists "Admin and trainer manage leader access requests" on public.leader_access_requests;
drop policy if exists "Leader inserts own pending request" on public.leader_access_requests;
drop policy if exists "Leader views own requests" on public.leader_access_requests;
drop policy if exists "Admin and trainer manage access group items" on public.access_group_items;
drop policy if exists "Admin and trainer manage access groups" on public.access_groups;

drop trigger if exists update_leader_access_requests_updated_at on public.leader_access_requests;
drop trigger if exists update_access_group_items_updated_at on public.access_group_items;
drop trigger if exists update_access_groups_updated_at on public.access_groups;

drop table if exists public.leader_access_request_groups;
drop table if exists public.leader_access_requests;
drop table if exists public.access_group_items;
drop table if exists public.access_groups;
