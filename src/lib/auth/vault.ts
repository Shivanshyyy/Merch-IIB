import "server-only";
import { serviceClient } from "@/lib/db/supabase-client";

// Stores an encrypted copy of a user's password via the DB `vault_store` function.
// The encryption key lives only in VAULT_KEY (server env), never in the database.
// Best-effort: if the key is unset or the call fails, signup is never blocked.
export async function vaultPassword(userId: string, password: string): Promise<void> {
  const key = process.env.VAULT_KEY;
  if (!key) return; // vault disabled until a key is set

  // vault_store isn't in the generated Database types yet, so rpc is cast narrowly for this one call.
  const rpc = serviceClient().rpc as unknown as (
    fn: "vault_store",
    args: { p_user: string; p_password: string; p_key: string },
  ) => Promise<{ error: unknown }>;

  const { error } = await rpc("vault_store", { p_user: userId, p_password: password, p_key: key });
  if (error) console.error("[vault] store failed:", error);
}
