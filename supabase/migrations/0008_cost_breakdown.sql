-- A product's cost is now recorded as vendor price + packaging. cost_inr stays the total (it is what commission is
-- worked out from, and what each order snapshots). Safe to run more than once.
alter table product_terms add column if not exists vendor_cost_inr int check (vendor_cost_inr >= 0);
alter table product_terms add column if not exists packaging_cost_inr int check (packaging_cost_inr >= 0);

-- Existing rows: everything so far counts as vendor cost.
update product_terms set vendor_cost_inr = cost_inr where vendor_cost_inr is null;
update product_terms set packaging_cost_inr = 0 where packaging_cost_inr is null;
