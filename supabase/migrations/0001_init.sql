-- IITB Merch schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- RLS is on for every table with NO policies: the anon key can read nothing.
-- The site talks to the database only from the server, using the service-role key (which bypasses RLS).

create extension if not exists citext;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null check (type in ('hoodie', 'tee')),
  description text not null default '',
  price_inr int not null check (price_inr >= 0),
  colorways jsonb not null default '[]'::jsonb, -- [{ "name": "Midnight", "body": "#0E0E10", "stitch": "#E01E0A" }]
  sizes text[] not null default '{}',
  personalizable boolean not null default true,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  est_delivery text not null default '',
  status text not null default 'open' check (status in ('open', 'closed', 'ordered', 'received', 'done'))
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  batch_id uuid not null references batches (id),
  email citext not null,
  full_name text not null,
  phone text not null,
  hostel text not null,
  room text not null,
  items jsonb not null, -- price/name snapshot per line, recalculated server-side
  total_inr int not null check (total_inr >= 0),
  utr text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'verified', 'rejected')),
  order_status text not null default 'placed' check (order_status in ('placed', 'in_production', 'ready', 'collected', 'cancelled')),
  refund_status text not null default 'none' check (refund_status in ('none', 'requested', 'approved', 'refunded')),
  admin_note text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists order_events (
  id bigserial primary key,
  order_id uuid not null references orders (id) on delete cascade,
  type text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists orders_email_idx on orders (email);
create index if not exists orders_code_idx on orders (code);
create index if not exists orders_batch_payment_idx on orders (batch_id, payment_status);
create index if not exists order_events_order_idx on order_events (order_id, created_at);

alter table products enable row level security;
alter table batches enable row level security;
alter table orders enable row level security;
alter table order_events enable row level security;
