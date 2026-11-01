-- 0005: name-print fee per product and cart offers on orders. Run after 0004. Safe to re-run.

-- Added to the unit price when a name is printed (₹99 on tees); 0 = free.
alter table products add column if not exists name_fee_inr int not null default 0 check (name_fee_inr >= 0);

-- The cart offer taken off the item subtotal; total_inr is what the customer pays after it.
alter table orders add column if not exists discount_inr int not null default 0 check (discount_inr >= 0);
alter table orders add column if not exists discount_label text;
