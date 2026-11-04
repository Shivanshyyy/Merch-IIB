import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
test("0007 adds name, backfills, and the trigger follows profile edits", async () => {
  const db = new PGlite();
  await db.exec(`create schema extensions; create function extensions.pgp_sym_encrypt(a text, b text) returns bytea language sql as $$ select convert_to(a, 'UTF8') $$;
    create table public.profiles(id uuid primary key, full_name text);
    create table public.credential_vault(user_id uuid primary key, password_ciphertext text not null, updated_at timestamptz default now());
    insert into public.profiles values ('00000000-0000-4000-8000-000000000001','Asha Rao');
    insert into public.credential_vault(user_id,password_ciphertext) values ('00000000-0000-4000-8000-000000000001','x');`);
  const sql = readFileSync("supabase/migrations/0007_vault_name.sql", "utf8");
  await db.exec(sql); await db.exec(sql); // twice: idempotent
  const q = async () => (await db.query<{ name: string }>("select name from public.credential_vault")).rows[0].name;
  assert.equal(await q(), "Asha Rao"); // backfilled
  await db.exec("update public.profiles set full_name='Asha R' where true");
  assert.equal(await q(), "Asha R"); // trigger
  await db.exec("insert into public.profiles values ('00000000-0000-4000-8000-000000000002','Ben Roy'); select public.vault_store('00000000-0000-4000-8000-000000000002','pw','k');");
  assert.equal((await db.query<{ name: string }>("select name from public.credential_vault where user_id='00000000-0000-4000-8000-000000000002'")).rows[0].name, "Ben Roy"); // vault_store
  await db.exec("select public.vault_store('00000000-0000-4000-8000-000000000002','pw2','k')"); // upsert still works
});
