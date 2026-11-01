# MERCH—IITB

Preorder storefront for personalised campus hoodies. Students pick a colour and size, type the name for the back, and pay by UPI. We collect orders in batches, send one sheet to the vendor, and everyone picks up at Hostel 4. Nothing is printed by us.

[CLAUDE.md](CLAUDE.md) is the full spec. [PROGRESS.md](PROGRESS.md) says what each build phase did and what is still open.

## To go live (the short version)

1. **Supabase:** create a project, run the SQL files, turn *Confirm email* off ([details](#set-up-the-database-supabase)).
2. **Vercel:** import the repo, add the environment variables ([details](#deploy-to-vercel)).
3. **Admin → Settings:** put in the UPI ID, WhatsApp number, pickup room and hours. Until then the pay page refuses to show a QR code on the live site.
4. **Admin → Products and Batches:** check the prices, open the first batch.
5. **Check it:** `node scripts/smoke-supabase.mjs` tells you if the database matches what the app expects.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: without Supabase keys the site runs on an in-memory DEMO store
npm run dev                  # http://localhost:3000
```

With no `SUPABASE_*` variables the site uses a demo store seeded from `supabase/seed.json`; logins, orders and settings vanish when the server restarts. The demo store is **switched off on Vercel production**, where missing keys make the site fail loudly instead of quietly losing orders. The admin password in local development is `admin`.

## Environment variables

Set these in `.env.local` while developing and in Vercel → Project → Settings → Environment Variables for the live site. None of them is ever sent to the browser.

| Variable | Where to get it | Used for |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | database and customer logins |
| `SUPABASE_ANON_KEY` | the same page, `anon` / publishable key | customer login (server only) |
| `SUPABASE_SERVICE_ROLE_KEY` | the same page, `service_role` key | all database access; bypasses RLS, so keep it secret |
| `ADMIN_PASSWORD` | you choose (12+ characters) | the password you type at `/admin/login` |
| `ADMIN_SESSION_SECRET` | `openssl rand -base64 48` | signs the admin cookie; must be 32+ characters |
| `SITE_URL` | your domain, e.g. `https://merch-iitb.shop` | share previews and the sitemap. Optional: on Vercel it falls back to the project's own address |

## Set up the database (Supabase)

1. Create a project at supabase.com (pick the Mumbai region, it is closest to campus).
2. **SQL Editor → New query:** paste each file in [`supabase/migrations/`](supabase/migrations) in order (`0001_init.sql`, then `0002_accounts_settings.sql`, then `0003_product_photos.sql`, then `0004_discounts_freebies.sql`) and **Run**.
3. New query again: paste [`supabase/seed.sql`](supabase/seed.sql) and **Run** (three placeholder hoodies, one open batch and the default settings; safe to run twice).
4. **Authentication → Providers → Email:** turn **Confirm email OFF**. Customers sign up with email and password only, and the app never sends email.
5. Copy the project URL, `anon` key and `service_role` key into the environment variables above.
6. Run `node scripts/smoke-supabase.mjs`. It checks the tables, the seed data, that the public key can read nothing, that *Confirm email* is off, and that the admin can create and reset a login. It cleans up after itself.

Row-level security is on for every table with no policies, so the public key can read nothing. All access goes through the server with the service-role key.

## Deploy to Vercel

1. Put the repo on GitHub and, at vercel.com, **Add New → Project → import it**. The Next.js settings are detected; leave them. [`vercel.json`](vercel.json) runs the server functions in Vercel's Mumbai region (`bom1`), next to a Mumbai Supabase project and your customers.
2. Add the environment variables above (Production, and Preview if you want preview deployments to work too). Deploy.
3. Open `https://<project>.vercel.app/admin`, log in, and go to **Settings**.
4. **Your own domain:** Vercel → Project → Settings → Domains → add it, then create the DNS records Vercel shows you at your registrar. Set `SITE_URL` to `https://your-domain` and redeploy so share previews use it.

> Vercel's free *Hobby* plan is for non-commercial projects. A store that takes payments belongs on a paid plan, or on another host that runs Next.js.

## Running the shop (for the team)

Everything below is in the admin panel at `/admin`. It works on a phone.

**Change a price or add a product.** *Products* → open one (or *New product*) → change **Price**, colourways (name, body colour, stitch colour), sizes, *Active* → Save. It is live in the shop straight away. Orders already placed keep the price they were made at. A new colourway shows a tinted hoodie until it has studio pictures: add it to `supabase/seed.json` and run `npm run stills`, or drop `<slug>-<colour>-front.webp` and `-back.webp` into `public/products/`.

**Add or remove the photos on the shop cards.** *Products* → open one → *Photos* → **Add photos** (pictures straight from a phone camera are fine: they are shrunk and cleaned of location data automatically, up to 8 per product). The first photo is the cover and the second appears when someone hovers the card; **Remove** (two taps) deletes one. The shop cards never load the 3D model. A product with no photos shows its studio picture instead. The photos are stored in the database, so there is no storage bucket to set up.

**Open a batch.** *Batches* → *New batch*: name, estimated delivery, when it opens, the cutoff (IST), and leave *Open now* ticked → Create. Opening a batch closes the others. At the cutoff the shop stops taking orders by itself. Move a batch along with its buttons: *Open → Closed → Sent to vendor → Received → Done*.

**Verify a payment.** *Orders* → filter *Payment: pending* → open an order. Look in your UPI app for a credit with the order code in the note (the customer may also have given a UTR, which shows in the order). When the amount matches, press **Verify payment**. The customer's *My orders* page updates immediately. If it does not match, **Reject payment** and use the WhatsApp button to ask for the screenshot.

**Send the batch to the vendor.** After the cutoff go to *Vendor sheet*, pick the batch, **Download CSV** (product, colour, size, name, quantity, order code; no phone, email or payment details) and send it. The pivot beside it counts product × colour × size so you can check the total.

**Pickup.** In the order drawer press **Move to production** when the vendor starts, **Mark ready** when the hoodies arrive (the WhatsApp button writes the message for you) and **Mark collected** when you hand it over.

**Refunds and fixes.** In the order drawer: **Start refund** → **Approve refund** → **Mark refunded** (eligible within the refund window for defective, misprinted or wrong items), correct a name or size (it is logged), leave a note. Every action is written to the order's history. *Customers* → reset a forgotten password and WhatsApp it to them.

**Business values.** *Settings* holds the UPI ID and payee name, WhatsApp number, pickup room and hours, refund window, name length, size chart and the fabric specs shown on the home page. The dashboard checklist shows which are still placeholders. The files [`src/config/settings.defaults.json`](src/config/settings.defaults.json) and [`supabase/seed.json`](supabase/seed.json) only hold the starting values (`npm run db:seed-sql` rebuilds `seed.sql` after editing the latter).

## How it is built

Next.js (App Router, Cache Components) with TypeScript and Tailwind. The home page is one fixed three.js canvas behind scrolling HTML, with the camera moved between shots by GSAP ScrollTrigger and Lenis smooth scrolling; the product page reuses the same model, while the shop cards are plain photos the admin uploads. Zustand holds the cart (localStorage); Supabase Postgres holds everything else, reached only from server actions and route handlers. Prices and totals are always recalculated on the server. Admin access is one password signed into an httpOnly cookie by `proxy.ts`. With reduced motion or without WebGL the site falls back to a static poster and everything still works.

The 17 MB source model (`assets-raw/hoodie.glb`) is never served: `npm run model:optimize` turns it into a 1.1 MB file (158k triangles, silhouette within 0.2% of the original) and scales it to the size the camera shots expect. The model is one mesh with one material, so a colourway recolours the cloth with its body colour and the chest emblem (and the name on the back) with its stitch colour; the metal drawstring tips keep their own colour. After swapping the model, run `npm run model:optimize`, `npm run model:compare` and `npm run stills`.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` / `build` / `start` | run, build, serve |
| `npm run lint` / `typecheck` / `test` | checks and unit tests (pricing, validation, checkout rules, accounts, admin, the SQL, motion helpers) |
| `npm run e2e` | Playwright: add to cart → sign up → checkout → pay page → admin verifies → customer sees it verified |
| `node scripts/with-server.mjs [--build] -- <cmd>` | starts **one** production server on :3000, runs the command, always stops it |
| `node scripts/polish.mjs --out=<dir>` | headless-browser walkthrough of the polish: marquee, headline reveals, cursor, page wipe, add-to-cart flight, plain shop cards, preloader, reduced motion, layout shift on every page |
| `node scripts/screenshots-home.mjs --out=<dir>` | the 3D home and product viewer: camera shots, drag, colourways, name on the back, fallbacks |
| `node scripts/screenshots-admin.mjs`, `scripts/screenshots-site.mjs` | admin and shop walkthroughs with screenshots |
| `node scripts/a11y.mjs [--admin]` | axe accessibility scan of every page at phone and desktop size |
| `node scripts/smoke-supabase.mjs` | checks a real Supabase project (see above) |
| `node scripts/make-og.mjs` | regenerates the share-preview images and app icons |
| `npm run model:optimize`, `model:compare`, `stills` | the 3D model pipeline and product stills |

Run the browser scripts through `with-server.mjs` (for example `node scripts/with-server.mjs --build -- node scripts/polish.mjs --out=/tmp/shots`) so only one server ever runs. They use software WebGL, which is slow but works anywhere; the frame rates they print are not GPU numbers.

## Troubleshooting

- **The pay page says "Payments are being set up".** The UPI ID is still the placeholder. Set it in Admin → Settings.
- **Customers can't sign up on the live site.** *Confirm email* is still on (see step 4 above), or a Supabase key is missing. `node scripts/smoke-supabase.mjs` says which.
- **The site says it isn't set up.** On Vercel production the demo store is off; one of the three `SUPABASE_*` variables is missing.
- **A customer forgot their password.** Admin → Customers → open them → set a new password (leave it empty to generate one) and send it on WhatsApp.
- **The 3D home is slow on a phone.** It starts on cheaper settings on phones and drops them further if the frame rate falls. Reduced-motion users and devices without WebGL get the static poster.

## Credits

The current hoodie model has no recorded author or licence, so no credit is shown. If its licence asks for one, fill in `modelCredit` in `src/config/site.ts`; the site footer and `/policies` show it as soon as it is set. The 17 MB original is git-ignored (`assets-raw/`), so keep a copy of it to re-run the optimiser.
