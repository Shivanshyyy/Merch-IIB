-- 0003: photos the admin uploads for the shop cards. Run after 0002. Safe to re-run.
-- Stored in the database (base64 text, already resized to WebP by the server, a few hundred KB at most) so there is no
-- storage bucket to set up. Served through /photos/<id>. RLS on with no policies: only the service role reads or writes.

create table if not exists product_photos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  mime text not null,
  data text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_photos_product_idx on product_photos (product_id, created_at);

alter table product_photos enable row level security;
