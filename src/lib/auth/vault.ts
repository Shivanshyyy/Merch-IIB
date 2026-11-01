import "server-only";
import { serviceClient } from "@/lib/db/supabase-client";

type VaultRpc = (fn: "vault_store", args: { p_user: string; p_password: string; p_key: string }) => Promise<{ error: unknown }>;

// Stores an encrypted copy of a user's password via the DB `vault_store` function.
// Best-effort: never throws, so signup can't break because of it.
export async function vaultPassword(userId: string, password: string): Promise<void> {
  const key = process.env.VAULT_KEY;
  if (!key) return;
  try {
    const client = serviceClient();
    // vault_store isn't in generated types; bind keeps rpc's `this` (unbound call crashed signup).
    const rpc = client.rpc.bind(client) as unknown as VaultRpc;
    const { error } = await rpc("vault_store", { p_user: userId, p_password: password, p_key: key });
    if (error) console.error("[vault] store failed:", error);
  } catch (e) {
    console.error("[vault] store threw:", e);
  }
}
