-- 0004: sale prices and the freebies offer. Run after 0003. Safe to re-run.

-- Original price shown crossed out; customers always pay price_inr.
alter table products add column if not exists compare_at_inr int check (compare_at_inr is null or compare_at_inr > 0);

-- Set when an admin verifies payment while the offer still has spots; cleared if the payment is rejected or reset.
alter table orders add column if not exists freebie boolean not null default false;
create index if not exists orders_freebie_idx on orders (freebie) where freebie;

-- Orders already paid before the offer existed take the first spots (only on the first run).
update orders set freebie = true
where id in (
  select id from orders
  where payment_status = 'verified' and order_status <> 'cancelled'
  order by verified_at nulls last, created_at
  limit 200
)
and not exists (select 1 from orders where freebie);

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
    items = case when p_patch ? 'items' then p_patch -> 'items' else items end,
    freebie = coalesce((p_patch ->> 'freebie')::boolean, freebie)
  where id = p_id
  returning * into result;

  if not found then
    raise exception 'order % not found', p_id using errcode = 'P0002';
  end if;

  insert into order_events (order_id, type, note) values (p_id, p_event_type, p_event_note);
  return result;
end;
$$;

revoke execute on function admin_patch_order(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function admin_patch_order(uuid, jsonb, text, text) to service_role;
