# MERCH—IITB

Preorder storefront for personalised campus hoodies. We collect orders and UPI payments, send one batch sheet to the vendor, and students pick up at Hostel 4. See [CLAUDE.md](CLAUDE.md) for the full spec.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: without Supabase keys the site runs on an in-memory DEMO store
npm run dev                  # http://localhost:3000
```

With no `SUPABASE_*` variables set, the site uses a demo store seeded from `supabase/seed.json`. Orders vanish when the server restarts. This fallback is **disabled on Vercel production**, where missing keys make the site fail loudly rather than lose orders.

## Environment variables

| Variable | Where to get it | Used for |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | server only |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / publishable key | server only, customer login |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key | server only, bypasses RLS: never prefix with `NEXT_PUBLIC_` |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | you choose | admin panel (Phase 2) |

## Set up the database (Supabase)

1. Create a project at supabase.com.
2. Open **SQL Editor → New query**, paste each file in [`supabase/migrations/`](supabase/migrations) in order (`0001_init.sql`, then `0002_accounts_settings.sql`) and **Run**.
3. New query again, paste [`supabase/seed.sql`](supabase/seed.sql), **Run** (3 placeholder hoodies, one open batch and the default settings; safe to re-run).
4. **Authentication → Providers → Email:** turn **Confirm email OFF**. Customers sign up with email + password only and the app never sends email.
5. Put the project URL, `anon` key and `service_role` key in `.env.local` and in Vercel → Settings → Environment Variables.

Row-level security is on for every table with no policies, so the public key can read nothing. All access is server-side with the service role.

## Admin panel

`/admin` (password from `ADMIN_PASSWORD`; in local development with no env set it is `admin`). Dashboard, orders (verify payments, move through production and pickup, refunds, edit a name or size, WhatsApp the customer), batches, products, customers (edit, reset a password), the vendor sheet (CSV + pivot) and **Settings** for every business value. Every change to an order is written to its history. Works on a phone.

## Business values to fill in

Once the site is live, change **everything in the admin panel**: UPI ID, phone, pickup and refund days under *Settings*; prices and products under *Products*; batches under *Batches*. The files below only hold the starting values:

- [`src/config/settings.defaults.json`](src/config/settings.defaults.json): the placeholder business values (UPI, phone, pickup, size chart...). The dashboard checklist shows which are still placeholders.
- [`supabase/seed.json`](supabase/seed.json): the starter products and batch. After editing run `npm run db:seed-sql` to regenerate `seed.sql`.

## Scripts

| Command | Does |
|---|---|
| `npm run build` / `npm run lint` / `npm run typecheck` | checks |
| `npm test` | unit tests for pricing, validation, checkout rules, UPI links |
| `npm run model:optimize` | `assets-raw/hoodie.glb` (43 MB) → `public/models/hoodie.glb` (~1.4 MB) |
| `npm run model:compare` | original vs optimised renders + silhouette overlap (`scripts/.out/compare.png`) |
| `npm run stills` | re-render product stills in `public/products/` from `seed.json` colourways |
| `node scripts/screenshots.mjs --base=http://localhost:3000 --out=<dir>` | phone + desktop walkthrough screenshots |

`assets-raw/` is git-ignored (43 MB source from Sketchfab). Download it again from the credit link below to re-run the optimiser.

## Credits

3D model "Classic Black Flame Hoodie" by [kril](https://sketchfab.com/3d-models/classic-black-flame-hoodie-0fd0effa321e456cb2a7467e2899b658), CC BY 4.0. Credited in the site footer and on `/policies`.
