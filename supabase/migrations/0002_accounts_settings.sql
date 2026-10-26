-- 0002: customer accounts, runtime settings, atomic admin order updates.
-- Run after 0001. Safe to re-run.

-- Customer profiles: one row per Supabase Auth user. Email + password only; the app never sends email.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text not null,
  phone text not null,
  roll_no text,
  default_size text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users may read and edit only their own row. (The site itself uses the service role, which bypasses RLS.)
drop policy if exists profiles_select_own on profiles;
drop policy if exists profiles_insert_own on profiles;
drop policy if exists profiles_update_own on profiles;
create policy profiles_select_own on profiles for select using (auth.uid() = id);
create policy profiles_insert_own on profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Orders belong to the logged-in customer who placed them.
alter table orders add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists orders_user_idx on orders (user_id, created_at desc);

-- Business values editable from /admin/settings. Exactly one row; RLS on with no policies.
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table settings enable row level security;

-- One admin action = one order update + one audit row, atomically. Only the patched keys change.
create or replace function admin_patch_order(p_id uuid, p_patch jsonb, p_event_type text, p_event_note text default null)
returns orders
language plpgsql
as $$
declare
  result orders;
begin
  update orders set
    payment_status = coalesce(p_patch ->> 'payment_status', payment_status),
    order_status = coalesce(p_patch ->> 'order_status', order_status),
    refund_status = coalesce(p_patch ->> 'refund_status', refund_status),
    admin_note = case when p_patch ? 'admin_note' then nullif(p_patch ->> 'admin_note', '') else admin_note end,
    utr = case when p_patch ? 'utr' then nullif(p_patch ->> 'utr', '') else utr end,
    verified_at = case when p_patch ? 'verified_at' then (p_patch ->> 'verified_at')::timestamptz else verified_at end,
    items = case when p_patch ? 'items' then p_patch -> 'items' else items end
  where id = p_id
  returning * into result;

  if not found then
    raise exception 'order % not found', p_id using errcode = 'P0002';
  end if;

  insert into order_events (order_id, type, note) values (p_id, p_event_type, p_event_note);
  return result;
end;
$$;

-- Callable only with the service-role key.
revoke execute on function admin_patch_order(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function admin_patch_order(uuid, jsonb, text, text) to service_role;
