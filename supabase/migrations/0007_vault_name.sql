-- Adds a readable `name` to public.credential_vault, filled from the user's profile.
-- credential_vault and vault_store were created by hand in Supabase, so everything here is skipped where the table
-- doesn't exist (a fresh database, the tests). Safe to run more than once.
do $outer$
begin
  if to_regclass('public.credential_vault') is null then
    return;
  end if;

  alter table public.credential_vault add column if not exists name text;

  -- Everyone already in the vault.
  update public.credential_vault v
     set name = p.full_name
    from public.profiles p
   where p.id = v.user_id and v.name is distinct from p.full_name;

  -- Same signature as before, so the app calls it exactly as it does today; it now records the name too.
  execute $fn$
    create or replace function public.vault_store(p_user uuid, p_password text, p_key text)
    returns void
    language sql
    security definer
    set search_path to 'public', 'extensions'
    as $body$
      insert into public.credential_vault(user_id, password_ciphertext, name)
      values (p_user, encode(extensions.pgp_sym_encrypt(p_password, p_key), 'base64'),
              (select full_name from public.profiles where id = p_user))
      on conflict (user_id) do update
        set password_ciphertext = excluded.password_ciphertext,
            name = coalesce(excluded.name, public.credential_vault.name),
            updated_at = now();
    $body$
  $fn$;

  -- Keep the name right when someone edits their profile.
  execute $fn$
    create or replace function public.vault_sync_name() returns trigger
    language plpgsql security definer set search_path to 'public'
    as $body$
    begin
      update public.credential_vault set name = new.full_name where user_id = new.id;
      return new;
    end
    $body$
  $fn$;
  execute 'drop trigger if exists profiles_vault_name on public.profiles';
  execute 'create trigger profiles_vault_name after update of full_name on public.profiles
           for each row when (old.full_name is distinct from new.full_name) execute function public.vault_sync_name()';
end
$outer$;
