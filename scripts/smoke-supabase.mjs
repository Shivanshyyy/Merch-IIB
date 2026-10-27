// Checks a real Supabase project against what the app needs. Run it once after the setup steps in the README:
//   node scripts/smoke-supabase.mjs          (reads .env.local, or the environment)
// It creates one throw-away customer and deletes it again; it changes nothing else.
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;

let failed = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg, hint) => {
  failed++;
  console.log(`  ✘ ${msg}${hint ? `\n      → ${hint}` : ""}`);
};
const check = (cond, msg, hint) => (cond ? ok(msg) : bad(msg, hint));

if (!url || !anonKey || !serviceKey) {
  console.log("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, opts);
const anon = createClient(url, anonKey, opts);

console.log("\nTables (migrations 0001 and 0002)");
for (const [table, cols] of [["products", "slug,price_inr,colorways"], ["batches", "name,status,closes_at"], ["orders", "code,user_id,items,payment_status"], ["order_events", "order_id,type"], ["profiles", "email,full_name,roll_no"], ["settings", "*"]]) {
  const { error } = await service.from(table).select(cols).limit(1);
  check(!error, `table ${table} exists with the columns the app reads`, error && `${error.message}. Run the SQL files in supabase/migrations in order.`);
}

console.log("\nSeed data");
const products = await service.from("products").select("slug", { count: "exact", head: true });
check((products.count ?? 0) > 0, `products: ${products.count ?? 0} row(s)`, "Run supabase/seed.sql, or add products in /admin/products.");
const open = await service.from("batches").select("name").eq("status", "open");
check((open.data?.length ?? 0) === 1, `exactly one open batch (${open.data?.map((b) => b.name).join(", ") || "none"})`, "Open one batch in /admin/batches; opening a batch closes the others.");

console.log("\nRow-level security (the public key must see nothing)");
for (const table of ["products", "batches", "orders", "profiles", "settings"]) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  check(!error && (data?.length ?? 0) === 0, `anon key reads no rows from ${table}`, "Enable RLS on every table and add no policies (see 0001/0002).");
}
const rpcAnon = await anon.rpc("admin_patch_order", { p_id: "00000000-0000-0000-0000-000000000000", p_patch: {}, p_event_type: "smoke" });
check(!!rpcAnon.error, "anon key cannot call admin_patch_order", "The function must be executable by service_role only (end of 0002).");
const rpcService = await service.rpc("admin_patch_order", { p_id: "00000000-0000-0000-0000-000000000000", p_patch: {}, p_event_type: "smoke" });
check(!!rpcService.error && !/does not exist|PGRST202/i.test(rpcService.error.message), "service role reaches admin_patch_order (and it refuses an unknown order)", rpcService.error?.message);

console.log("\nAuth (email + password only, no confirmation emails)");
const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } }).then((r) => r.json()).catch(() => null);
check(settings?.mailer_autoconfirm === true, "Confirm email is OFF", "Supabase → Authentication → Providers → Email → turn Confirm email off.");
const email = `smoke.${Date.now()}@example.com`;
const password = "smoke-test-password-123";
let userId;
try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  userId = created.data.user?.id;
  check(!created.error && !!userId, "service role can create a customer", created.error?.message);
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  check(!signedIn.error && !!signedIn.data.session, "that customer can log in with email + password", signedIn.error?.message);
  const reset = await service.auth.admin.updateUserById(userId, { password: `${password}-new` });
  check(!reset.error, "service role can reset a customer's password (the admin Customers page)", reset.error?.message);
} finally {
  if (userId) await service.auth.admin.deleteUser(userId);
}

console.log(failed ? `\n${failed} check(s) failed.\n` : "\nAll good: the project matches what the app expects.\n");
process.exit(failed ? 1 : 0);
