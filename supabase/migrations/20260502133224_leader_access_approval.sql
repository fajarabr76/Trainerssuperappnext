-- Leader Access Approval: access groups + request/approval workflow
-- Modules: ktp (profiler) and sidak (qa-analyzer)
-- Admins/trainers manage groups and approve leader requests

-- 1. access_groups: daftar scope/list data
create table if not exists public.access_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  scope_type  text not null default 'union' check (scope_type in ('union')),
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.access_groups is 'Access group definitions for leader data scope';

-- 2. access_group_items: individual scope items within a group
create table if not exists public.access_group_items (
  id              uuid primary key default gen_random_uuid(),
  access_group_id uuid not null references public.access_groups(id) on delete cascade,
  field_name      text not null check (field_name in ('peserta_id', 'batch_name', 'tim', 'service_type')),
  field_value     text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_access_group_items_group_id on public.access_group_items(access_group_id);

comment on table public.access_group_items is 'Individual scope items (union rules) within an access group';

-- 3. leader_access_requests: request per leader + module
create table if not exists public.leader_access_requests (
  id              uuid primary key default gen_random_uuid(),
  leader_user_id  uuid not null references public.profiles(id) on delete cascade,
  module          text not null check (module in ('ktp', 'sidak', 'all')),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  reviewed_by     uuid references public.profiles(id),
  review_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_leader_access_requests_user_id on public.leader_access_requests(leader_user_id);
create index if not exists idx_leader_access_requests_module on public.leader_access_requests(module);
create index if not exists idx_leader_access_requests_status on public.leader_access_requests(status);

-- Partial unique index: mencegah >1 active request (pending/approved) per leader + module
create unique index if not exists uq_leader_access_requests_active_per_user_module
  on public.leader_access_requests (leader_user_id, module)
  where status in ('pending', 'approved');

comment on table public.leader_access_requests is 'Leader access requests per module, approved by admin/trainer';

-- 4. leader_access_request_groups: join table linking approved requests to access groups
create table if not exists public.leader_access_request_groups (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.leader_access_requests(id) on delete cascade,
  access_group_id uuid not null references public.access_groups(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(request_id, access_group_id)
);

create index if not exists idx_leader_access_request_groups_request_id
  on public.leader_access_request_groups(request_id);
create index if not exists idx_leader_access_request_groups_group_id
  on public.leader_access_request_groups(access_group_id);

comment on table public.leader_access_request_groups is 'Join table linking approved access requests to access groups';

-- 5. updated_at trigger function (reusable)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply triggers
drop trigger if exists update_access_groups_updated_at on public.access_groups;
create trigger update_access_groups_updated_at
  before update on public.access_groups
  for each row execute function update_updated_at_column();

drop trigger if exists update_access_group_items_updated_at on public.access_group_items;
create trigger update_access_group_items_updated_at
  before update on public.access_group_items
  for each row execute function update_updated_at_column();

drop trigger if exists update_leader_access_requests_updated_at on public.leader_access_requests;
create trigger update_leader_access_requests_updated_at
  before update on public.leader_access_requests
  for each row execute function update_updated_at_column();

-- 6. RLS: enable on all tables
alter table public.access_groups enable row level security;
alter table public.access_group_items enable row level security;
alter table public.leader_access_requests enable row level security;
alter table public.leader_access_request_groups enable row level security;

-- 6a. access_groups policies
drop policy if exists "Admin and trainer manage access groups" on public.access_groups;
create policy "Admin and trainer manage access groups"
  on public.access_groups
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  );

-- 6b. access_group_items policies
drop policy if exists "Admin and trainer manage access group items" on public.access_group_items;
create policy "Admin and trainer manage access group items"
  on public.access_group_items
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  );

-- 6c. leader_access_requests policies
drop policy if exists "Leader views own requests" on public.leader_access_requests;
create policy "Leader views own requests"
  on public.leader_access_requests
  for select
  using (leader_user_id = auth.uid());

drop policy if exists "Leader inserts own pending request" on public.leader_access_requests;
create policy "Leader inserts own pending request"
  on public.leader_access_requests
  for insert
  with check (
    leader_user_id = auth.uid()
    and status = 'pending'
    and module in ('ktp', 'sidak', 'all')
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('leader', 'leaders')
    )
  );

drop policy if exists "Admin and trainer manage leader access requests" on public.leader_access_requests;
create policy "Admin and trainer manage leader access requests"
  on public.leader_access_requests
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  );

-- 6d. leader_access_request_groups policies
drop policy if exists "Admin and trainer manage access request groups" on public.leader_access_request_groups;
create policy "Admin and trainer manage access request groups"
  on public.leader_access_request_groups
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('trainer', 'trainers', 'admin')
    )
  );

drop policy if exists "Leader views own request groups" on public.leader_access_request_groups;
create policy "Leader views own request groups"
  on public.leader_access_request_groups
  for select
  using (
    exists (
      select 1 from public.leader_access_requests
      where leader_access_requests.id = request_id
        and leader_access_requests.leader_user_id = auth.uid()
    )
  );

-- 7. Function: get active leader scope items for approved request
create or replace function public.get_leader_approved_scope_items(
  p_leader_user_id uuid,
  p_module text
)
returns table(
  field_name text,
  field_value text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select agi.field_name, agi.field_value
  from public.leader_access_requests lar
  inner join public.leader_access_request_groups larg
    on larg.request_id = lar.id
  inner join public.access_groups ag
    on ag.id = larg.access_group_id
    and ag.is_active = true
  inner join public.access_group_items agi
    on agi.access_group_id = ag.id
    and agi.is_active = true
  where lar.leader_user_id = p_leader_user_id
    and lar.status = 'approved'
    and (lar.module = p_module or lar.module = 'all')
  order by agi.field_name;
end;
$$;

revoke execute on function public.get_leader_approved_scope_items(uuid, text) from public;
revoke execute on function public.get_leader_approved_scope_items(uuid, text) from anon;
grant execute on function public.get_leader_approved_scope_items(uuid, text) to authenticated;
