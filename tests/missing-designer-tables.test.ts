import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabaseDb } from "@/lib/db/supabase";
import type { ServiceClient } from "@/lib/db/supabase-client";

// A fake client where every query ends in the given error, like a database that never got migration 0006.
const failing = (error: { code: string; message: string }) => {
  const chain: unknown = new Proxy(() => chain, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve({ data: null, error, count: null }) : () => chain),
    apply: () => chain,
  });
  return { from: () => chain } as unknown as ServiceClient;
};

const noTable = { code: "PGRST205", message: "Could not find the table 'public.designers' in the schema cache" };

test("without the designer tables, reads say there is nothing there instead of throwing", async () => {
  const d = createSupabaseDb(failing(noTable));
  assert.equal(await d.getDesigner("00000000-0000-4000-8000-000000000000"), null);
  assert.deepEqual(await d.listDesigners(), []);
  assert.deepEqual(await d.listDesigners("pending"), []);
  assert.deepEqual(await d.listDesigns("in_review"), []);
  assert.deepEqual(await d.listProductTerms(), []);
  assert.equal(await d.getProductTerms("00000000-0000-4000-8000-000000000000"), null);
  assert.deepEqual(await d.listPayouts(), []);
});

test("Postgres's own missing-relation error is treated the same way", async () => {
  const d = createSupabaseDb(failing({ code: "42P01", message: 'relation "public.designers" does not exist' }));
  assert.equal(await d.getDesigner("00000000-0000-4000-8000-000000000000"), null);
});

test("writes still fail loudly, and so does any other database error", async () => {
  const missing = createSupabaseDb(failing(noTable));
  await assert.rejects(() => missing.createDesigner("00000000-0000-4000-8000-000000000000", { bio: null, upi_id: null }), /createDesigner/);

  const broken = createSupabaseDb(failing({ code: "XX000", message: "connection lost" }));
  await assert.rejects(() => broken.getDesigner("00000000-0000-4000-8000-000000000000"), /connection lost/);
  await assert.rejects(() => broken.listProductTerms(), /connection lost/);
});
