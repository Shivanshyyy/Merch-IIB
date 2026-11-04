// Runs every migration + the seed on a real Postgres engine (PGlite) with Supabase's roles and auth schema stubbed,
// then checks RLS, permissions and the atomic admin function. Add a test here whenever a migration changes behaviour.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";

const root = new URL("../supabase/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const migrations = readdirSync(new URL("migrations/", root)).filter((f) => f.endsWith(".sql")).sort();

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
let db: PGlite;

// Runs fn as a Supabase role (RLS applies) with auth.uid() = sub.
const as = async <T>(role: "anon" | "authenticated" | "service_role", sub: string | null, fn: () => Promise<T>) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.sub', '${sub ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
};

before(async () => {
  db = new PGlite({ extensions: { citext } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  await db.exec("create extension if not exists citext;");
  for (const m of migrations) await db.exec(read(`migrations/${m}`));
  await db.exec(read("seed.sql"));
  await db.exec("grant all on all tables in schema public to anon, authenticated, service_role; grant all on all sequences in schema public to anon, authenticated, service_role;");
  await db.exec(`insert into auth.users (id, email) values ('${alice}','alice@example.com'), ('${bob}','bob@example.com');`);
});

test("migrations and seed re-run cleanly (idempotent)", async () => {
  for (const m of migrations) await db.exec(read(`migrations/${m}`));
  await db.exec(read("seed.sql"));
  assert.deepEqual((await db.query("select count(*)::int n from products")).rows[0], { n: 6 });
  assert.deepEqual((await db.query("select count(*)::int n from settings")).rows[0], { n: 1 });
  assert.deepEqual((await db.query("select value->>'brand' b from settings")).rows[0], { b: "IITB-Merch" });
});

test("profiles: users read, insert and update only their own row", async () => {
  await as("authenticated", alice, () => db.query("insert into profiles (id,email,full_name,phone) values ($1,'alice@example.com','Alice A','9876543210')", [alice]));
  await as("authenticated", bob, () => db.query("insert into profiles (id,email,full_name,phone) values ($1,'bob@example.com','Bob B','9876543211')", [bob]));
  await assert.rejects(as("authenticated", alice, () => db.query("insert into profiles (id,email,full_name,phone) values ($1,'x@example.com','Mallory','9876543212')", [bob])), /row-level security/);

  assert.deepEqual((await as("authenticated", alice, () => db.query("select full_name from profiles"))).rows, [{ full_name: "Alice A" }]);
  await as("authenticated", alice, () => db.query("update profiles set full_name='Bob hacked' where id=$1", [bob]));
  assert.deepEqual((await db.query("select full_name from profiles where id=$1", [bob])).rows[0], { full_name: "Bob B" });
  await as("authenticated", alice, () => db.query("update profiles set roll_no='22B1', default_size='M' where id=$1", [alice]));
  assert.deepEqual((await db.query("select default_size from profiles where id=$1", [alice])).rows[0], { default_size: "M" });
  assert.equal((await as("anon", null, () => db.query("select * from profiles"))).rows.length, 0);
});

test("emails are unique case-insensitively", async () => {
  await assert.rejects(db.query("insert into profiles (id,email,full_name,phone) values ($1,'ALICE@example.com','Dup','9876543210')", [bob]), /unique|duplicate/);
});

test("RLS with no policies hides everything else from anon and authenticated", async () => {
  for (const t of ["products", "batches", "orders", "order_events", "settings"]) {
    assert.equal((await as("anon", null, () => db.query(`select * from ${t}`))).rows.length, 0, t);
    assert.equal((await as("authenticated", alice, () => db.query(`select * from ${t}`))).rows.length, 0, t);
  }
});

test("product photos: private to the service role, and they go when their product goes", async () => {
  const product = (await db.query<{ id: string }>("insert into products (slug,name,type,price_inr) values ('photo-test','Photo test','hoodie',100) returning id")).rows[0].id;
  await db.query("insert into product_photos (product_id, mime, data) values ($1,'image/webp','AAAA')", [product]);
  assert.equal((await as("anon", null, () => db.query("select * from product_photos"))).rows.length, 0);
  assert.equal((await as("authenticated", alice, () => db.query("select * from product_photos"))).rows.length, 0);
  assert.equal((await as("service_role", null, () => db.query("select * from product_photos"))).rows.length, 1);

  await db.query("delete from products where id=$1", [product]);
  assert.deepEqual((await db.query("select count(*)::int n from product_photos")).rows[0], { n: 0 });
});

test("admin_patch_order: atomic update + audit row, service role only", async () => {
  const batch = (await db.query<{ id: string }>("select id from batches limit 1")).rows[0].id;
  const order = (
    await db.query<{ id: string }>("insert into orders (code,batch_id,user_id,email,full_name,phone,hostel,room,items,total_inr) values ('HD-AAAA',$1,$2,'alice@example.com','Alice','9876543210','H4','1',$3,1998) returning id", [
      batch,
      alice,
      JSON.stringify([{ slug: "a", name: "ARYAN", size: "M", qty: 2 }]),
    ])
  ).rows[0].id;

  const call = (id: string, patch: object, type: string, note: string | null = null) => as("service_role", null, () => db.query<Record<string, unknown>>("select * from admin_patch_order($1,$2::jsonb,$3,$4)", [id, JSON.stringify(patch), type, note]));
  await assert.rejects(as("anon", null, () => db.query("select admin_patch_order($1,'{}'::jsonb,'x',null)", [order])), /permission denied/);
  await assert.rejects(as("authenticated", alice, () => db.query("select admin_patch_order($1,'{}'::jsonb,'x',null)", [order])), /permission denied/);

  let r = (await call(order, { payment_status: "verified", verified_at: "2026-11-01T10:00:00Z" }, "payment_verified", "matched UTR")).rows[0];
  assert.equal(r.payment_status, "verified");
  assert.equal(r.order_status, "placed");
  assert.ok(r.verified_at);

  r = (await call(order, { order_status: "in_production" }, "status_in_production")).rows[0];
  assert.equal(r.payment_status, "verified", "untouched columns are preserved");
  r = (await call(order, { admin_note: "Call before pickup" }, "note_updated")).rows[0];
  assert.equal(r.admin_note, "Call before pickup");
  r = (await call(order, { admin_note: "" }, "note_updated")).rows[0];
  assert.equal(r.admin_note, null);
  r = (await call(order, { payment_status: "pending", verified_at: null }, "payment_reset")).rows[0];
  assert.equal(r.verified_at, null);
  r = (await call(order, { items: [{ slug: "a", name: "ARYAN K.", size: "L", qty: 2 }] }, "item_edited", "name+size")).rows[0];
  assert.equal((r.items as { name: string }[])[0].name, "ARYAN K.");
  assert.equal(r.total_inr, 1998);

  await assert.rejects(call(order, { payment_status: "bogus" }, "payment_bogus"), /check constraint/);
  await assert.rejects(call("33333333-3333-4333-8333-333333333333", { order_status: "ready" }, "x"), /not found/);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from order_events where order_id=$1", [order])).rows[0].n, 6, "failed patches write no audit row");
});

test("settings is a single row", async () => {
  await assert.rejects(db.query("insert into settings (id, value) values (2, '{}')"), /check constraint/);
  await as("service_role", null, () => db.query(`insert into settings (id, value) values (1, '{"upiId":"a@b"}') on conflict (id) do update set value = excluded.value`));
  assert.deepEqual((await db.query("select value->>'upiId' v from settings")).rows[0], { v: "a@b" });
});

test("designers: need a commission to be approved, and are private to the service role", async () => {
  await db.query("insert into designers (id, bio, upi_id) values ($1, 'Posters', 'bob@upi')", [bob]);
  assert.deepEqual((await db.query("select status, commission_pct from designers where id=$1", [bob])).rows[0], { status: "pending", commission_pct: null });
  await assert.rejects(db.query("update designers set status='approved' where id=$1", [bob]), /check constraint/);
  await assert.rejects(db.query("update designers set status='boss' where id=$1", [bob]), /check constraint/);
  await assert.rejects(db.query("update designers set commission_pct=101 where id=$1", [bob]), /check constraint/);
  await db.query("update designers set status='approved', commission_pct=7 where id=$1", [bob]);
  await assert.rejects(db.query("insert into designers (id) values ('44444444-4444-4444-8444-444444444444')"), /foreign key|violates/, "a designer needs a profile first");
});

test("designs, images, terms and payouts: private, validated, and cascades behave", async () => {
  const design = (await db.query<{ id: string }>("insert into designs (designer_id, title, product_type) values ($1, 'Lake', 'hoodie') returning id", [bob])).rows[0].id;
  assert.deepEqual((await db.query("select status, colorways from designs where id=$1", [design])).rows[0], { status: "draft", colorways: [] });
  await assert.rejects(db.query("insert into designs (designer_id, title, product_type) values ($1, 'x', 'cap')", [bob]), /check constraint/);
  await assert.rejects(db.query("update designs set status='published' where id=$1", [design]), /check constraint/);
  await assert.rejects(db.query("update designs set suggested_price_inr=0 where id=$1", [design]), /check constraint/);

  await db.query("insert into design_images (design_id, mime, data) values ($1, 'image/webp', 'AAAA')", [design]);
  const product = (await db.query<{ id: string }>("insert into products (slug,name,type,price_inr) values ('lake-hoodie','Lake','hoodie',999) returning id")).rows[0].id;
  await db.query("insert into product_terms (product_id, designer_id, design_id, cost_inr, commission_pct) values ($1,$2,$3,600,7)", [product, bob, design]);
  await db.query("update designs set status='live', product_id=$2 where id=$1", [design, product]);
  await assert.rejects(db.query("update product_terms set cost_inr=-1 where product_id=$1", [product]), /check constraint/);
  await db.query("insert into designer_payouts (designer_id, amount_inr, reference) values ($1, 50, 'UTR1')", [bob]);
  await assert.rejects(db.query("insert into designer_payouts (designer_id, amount_inr) values ($1, 0)", [bob]), /check constraint/);

  for (const t of ["designers", "designs", "design_images", "product_terms", "designer_payouts"]) {
    assert.equal((await as("anon", null, () => db.query(`select * from ${t}`))).rows.length, 0, `${t} hidden from anon`);
    assert.equal((await as("authenticated", bob, () => db.query(`select * from ${t}`))).rows.length, 0, `${t} hidden from the owner too`);
    assert.ok((await as("service_role", null, () => db.query(`select * from ${t}`))).rows.length >= 1, `${t} visible to the service role`);
  }

  // Deleting the product removes its terms and unlinks (not deletes) the design.
  await db.query("delete from products where id=$1", [product]);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from product_terms where product_id=$1", [product])).rows[0].n, 0);
  assert.deepEqual((await db.query("select product_id from designs where id=$1", [design])).rows[0], { product_id: null });

  // Deleting a design removes its images and keeps any terms row (design_id cleared).
  const product2 = (await db.query<{ id: string }>("insert into products (slug,name,type,price_inr) values ('lake-tee','Lake tee','tee',499) returning id")).rows[0].id;
  await db.query("insert into product_terms (product_id, designer_id, design_id, cost_inr, commission_pct) values ($1,$2,$3,300,5)", [product2, bob, design]);
  await db.query("delete from designs where id=$1", [design]);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from design_images where design_id=$1", [design])).rows[0].n, 0);
  assert.deepEqual((await db.query("select design_id, designer_id from product_terms where product_id=$1", [product2])).rows[0], { design_id: null, designer_id: bob });
});

test("a designer's sales are found by the designer id on order items", async () => {
  const batch = (await db.query<{ id: string }>("select id from batches limit 1")).rows[0].id;
  const items = (id: string) => JSON.stringify([{ slug: "lake-tee", qty: 2, unitPriceInr: 499, designer: { id, costInr: 300, pct: 5, unitCommissionInr: 9 } }]);
  await db.query("insert into orders (code,batch_id,email,full_name,phone,hostel,room,items,total_inr) values ('HD-SALE',$1,'x@example.com','X','9876543210','H4','1',$2,998), ('HD-NOPE',$1,'y@example.com','Y','9876543210','H4','1',$3,998)", [batch, items(bob), items(alice)]);
  const found = await db.query<{ code: string }>("select code from orders where items @> $1::jsonb", [JSON.stringify([{ designer: { id: bob } }])]);
  assert.deepEqual(found.rows, [{ code: "HD-SALE" }]);
});

test("a designer with payouts can't be deleted by accident, one without can", async () => {
  await assert.rejects(db.query("delete from auth.users where id=$1", [bob]), /foreign key|violates/);
  await db.query("delete from designer_payouts where designer_id=$1", [bob]);
  await db.query("delete from auth.users where id=$1", [bob]);
  assert.deepEqual((await db.query("select count(*)::int n from designers where id=$1", [bob])).rows[0], { n: 0 });
  assert.deepEqual((await db.query("select count(*)::int n from profiles where id=$1", [bob])).rows[0], { n: 0 });
});

test("deleting an auth user removes the profile but keeps their orders", async () => {
  await db.query("delete from auth.users where id=$1", [alice]);
  assert.deepEqual((await db.query("select count(*)::int n from profiles where id=$1", [alice])).rows[0], { n: 0 });
  assert.deepEqual((await db.query("select user_id from orders where code='HD-AAAA'")).rows[0], { user_id: null });
});
