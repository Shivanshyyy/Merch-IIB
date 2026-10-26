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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key | server only, bypasses RLS: never prefix with `NEXT_PUBLIC_` |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | you choose | admin panel (Phase 2) |

## Set up the database (Supabase)

1. Create a project at supabase.com.
2. Open **SQL Editor → New query**, paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), **Run**.
3. New query again, paste [`supabase/seed.sql`](supabase/seed.sql), **Run** (3 placeholder hoodies and one open batch; safe to re-run).
4. Put the project URL and `service_role` key in `.env.local` and in Vercel → Settings → Environment Variables.

Row-level security is on for every table with no policies, so the public key can read nothing. All access is server-side with the service role.

## Business values to fill in

- [`src/config/site.ts`](src/config/site.ts): UPI ID, payee name, phone/WhatsApp, pickup room and hours, size chart, fabric specs. Search for `TODO`.
- [`supabase/seed.json`](supabase/seed.json): products, prices, sizes, colourways, batch dates. After editing run `npm run db:seed-sql` to regenerate `seed.sql`. Once the site is live, change prices in the admin panel (Phase 2), not here.

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
