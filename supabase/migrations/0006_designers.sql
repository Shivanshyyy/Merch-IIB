-- 0006: designer accounts, designs, product terms (cost + commission) and payouts. Run after 0005. Safe to re-run.
-- Everything here is private: RLS on with no policies, so only the service role (the server) can read or write.

-- A designer is a customer profile that applied to publish designs; the admin approves them and sets the commission.
create table if not exists designers (
  id uuid primary key references profiles (id) on delete cascade,
  bio text,
  upi_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  commission_pct int check (commission_pct between 0 and 100), -- the 4-10 range is enforced by the app
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'approved' or commission_pct is not null)
);
create index if not exists designers_status_idx on designers (status, created_at desc);
alter table designers enable row level security;

create table if not exists designs (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references designers (id) on delete cascade,
  title text not null,
  description text not null default '',
  product_type text not null check (product_type in ('hoodie', 'tee')),
  colorways jsonb not null default '[]'::jsonb,
  suggested_price_inr int check (suggested_price_inr is null or suggested_price_inr > 0),
  print_file_url text,
  originality_confirmed_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'changes_requested', 'approved', 'rejected', 'live', 'retired')),
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  product_id uuid references products (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designs_designer_idx on designs (designer_id, created_at desc);
create index if not exists designs_status_idx on designs (status, submitted_at);
alter table designs enable row level security;

-- Design images, stored like product photos: resized WebP as base64 text, served through /design-images/<id>.
create table if not exists design_images (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs (id) on delete cascade,
  mime text not null,
  data text not null,
  created_at timestamptz not null default now()
);
create index if not exists design_images_design_idx on design_images (design_id, created_at);
alter table design_images enable row level security;

-- What a product costs to make and who designed it. Never exposed to the shop.
create table if not exists product_terms (
  product_id uuid primary key references products (id) on delete cascade,
  designer_id uuid references designers (id) on delete set null,
  design_id uuid references designs (id) on delete set null,
  cost_inr int not null check (cost_inr >= 0),
  commission_pct int check (commission_pct between 0 and 100), -- optional override; null = use the designer's own rate
  updated_at timestamptz not null default now()
);
create index if not exists product_terms_designer_idx on product_terms (designer_id);
alter table product_terms enable row level security;

-- Money paid out to designers. "restrict" keeps a designer with payouts from being deleted by accident.
create table if not exists designer_payouts (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references designers (id) on delete restrict,
  amount_inr int not null check (amount_inr > 0),
  reference text,
  note text,
  paid_at timestamptz not null default now()
);
create index if not exists designer_payouts_designer_idx on designer_payouts (designer_id, paid_at desc);
alter table designer_payouts enable row level security;

-- A designer's sales are the orders whose items carry their id (the share is snapshotted on each item at order time).
create index if not exists orders_items_gin on orders using gin (items jsonb_path_ops);
