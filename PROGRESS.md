# Progress

Short log, one entry per phase: what's done, what's left, open TODOs.

## Phase 0 — Setup ✅
- **Done:** Next.js 16 (Cache Components) + Tailwind 4 scaffold; design tokens, fluid type, film grain, direction-aware buttons; layout shell (nav, footer, cart drawer); model pipeline (now the IITB-emblem hoodie: 17 MB → 1.1 MB, 158k tris, silhouette ≥ 99.8%; replaced the first flame hoodie on 2026-10-27, which was 43 MB → 1.4 MB) with headless-WebGL compare/stills renderer; typed `HoodieModel`; Supabase schema + seed (RLS on, validated on a real Postgres engine).
- **Left:** nothing for this phase.
- **Open TODOs:** none.

## Phase 1 — Commerce core ✅
- **Done:** shop, product page (colour/size/name with live back preview), cart + drawer, checkout, server-priced orders, pay page (UPI QR, copy, Open-UPI, WhatsApp/call, UTR), policies, 404. 22 unit tests, axe clean.
- **Left:** nothing for this phase.
- **Open TODOs:** none.

## Phase 1b — Customer accounts + runtime settings (spec update) ✅
- **Done:**
  - Accounts (email + password only, no emails ever sent): sign-up / log-in panel, checkout gate (cart survives login), `/account` (profile + change password), `/orders` (replaces `/track`, which now redirects), nav account menu, orders tied to `user_id`, pay page owner-only, saved size preselected on product pages.
  - Auth backend behind one interface: Supabase (`@supabase/ssr`, httpOnly cookies, `getClaims()`) and a demo backend (hashed passwords, signed cookie) that is off on Vercel production.
  - Business values now live in the DB `settings` row (`getSettings()` cached + tag, `getSettingsFresh()` for money paths); defaults in `src/config/settings.defaults.json`. Pay page refuses to show a QR in production while the UPI ID is the placeholder.
  - Migration `0002` (profiles + RLS, `orders.user_id`, `settings`, atomic `admin_patch_order`) verified in a permanent PGlite test suite (`tests/sql.test.ts`). 38 tests total.
  - `scripts/with-server.mjs`: runs ONE server on port 3000 around any command and always kills it.
- **Left:** the UI to edit settings and manage customers (Phase 2).
- **Open TODOs:** Supabase code paths could not run against a real project (no keys); they are type-checked against a hand-written `Database` type. Smoke-test after setting keys.

## Phase 2 — Admin ✅
- **Done:**
  - Access: `ADMIN_PASSWORD` login → signed (jose) httpOnly cookie, 7 days, scoped to `/admin`; `proxy.ts` guards every `/admin` URL; every server action and the CSV route re-check the cookie; login throttle (5 misses / 10 min) + constant delay.
  - Dashboard (batch filter scopes everything): verified revenue (hero), orders, pending verifications, open refunds, items to make, items per size (bars + table twin), "needs verifying" list, setup checklist.
  - Orders: search (code / email / name / phone), payment / status / refund / batch filters, sort, pagination, tone-coded rows with icon + label chips, table on desktop and cards on phone. Drawer: verify / reject / reset payment, production → ready → collected, cancel / reopen, refund flow, edit a name or size, admin note, WhatsApp message per status (editable), full audit history. Every action is one atomic update + audit row.
  - Batches (create, edit, open/close/progress; opening closes the others), vendor sheet (CSV + product × colour × size pivot; no contact or payment data), products CRUD (live in the shop immediately), customers (search, edit, reset password + WhatsApp it), **Settings** (every business value, size chart and fabric-spec editors, live immediately).
  - 56 unit tests (flow rules, stats, CSV injection guard, tokens, throttle, admin DB ops); full browser walkthrough at desktop + phone; axe clean on all admin pages.
  - Found and fixed: a Server → Client function prop crash; Activity (hidden-page) state leaks (stale checkout "Order placed", retained password field, armed delete buttons, stale filters) via `FreshOnVisit` and cleanups.
- **Left:** nothing for this phase.
- **Open TODOs:** Supabase admin queries (`.or()` search, `admin_patch_order` RPC) are type-checked and the SQL is tested, but untested against a live project. New colourways have no studio photo until the 3D viewer lands (Phase 3).

## Phase 3 — The 3D home ✅
- **Done:**
  - One fixed canvas behind the page (lazy, `ssr: false`, paused when hidden or off-screen): midnight backdrop shader with an ember halo, reflective floor fading into fog, baked soft shadow, ember sparkles, a Lightformer rig with a rim light that complements each colourway. Bloom / vignette / noise on desktop only; `PerformanceMonitor` demotes quality; weak devices start on the cheap settings. The scene is only "ready" once its shaders are compiled, so it appears smoothly.
  - Camera: 40 s idle orbit with ±0.15 bob while the hoodie turns the other way; drag to orbit (damped, no pan or zoom, can't go under the floor); dragging pauses the orbit, which blends back after 3 s or on scroll; double-click / double-tap resets with an ease.
  - Seven scroll shots (GSAP ScrollTrigger scrub + Lenis) with their sections. Callouts are pinned to real points on the cloth and flip, wrap or hide so they stay on screen and off the text. The name on the back is a projected decal (kept inside the back panel so the sleeves never slice it); colourways cross-fade over 600 ms.
  - Product page: live 3D viewer (Front / Back, drag, auto-turn until touched) over the studio still, which stays as the instant first paint and as the fallback; a tinted hoodie glyph stands in for colourways without a still.
  - Reduced motion or no WebGL: a static poster that still follows the colour and name; every section works.
  - 73 unit tests. Browser walkthrough with real assertions at 1440×900 and 390×844: idle orbit, shot poses, decal geometry, colour fade, drag → pause → resume timing, double-click reset, hero fills ~55% of the height, callouts clear of the text, fallbacks.
  - Found and fixed on the way: name sliced by the sleeve shells at oblique angles; callout labels landing on the copy or off screen on phones; a smeared hoodie behind the "How it works" list; "ready" firing before shaders were compiled.
- **Left:** preloader, cursor, page transitions, text reveals, marquee, add-to-cart fly (Phase 4).
- **Open TODOs:** Frame rate was only measured on software WebGL (4–19 fps), so the 60 fps / mid-range Android targets need a check on real devices. Fabric Weight and Fit are placeholders until the vendor confirms them (Admin → Settings).

## Phase 4 — Polish ✅
- **Done:**
  - **Preloader** on the home page: a 000 → 100 mono counter driven by the real model download plus the scene's first compiled frame; at 100 it turns red and splits along its middle to reveal the scene. In the server HTML so it is the first paint; plays once per session; a Skip button after 5 s; absent for reduced motion and no WebGL.
  - **Marquee strip** above the nav on every customer page: `PREORDER BATCH 01 · CLOSES IN 13D 23H 59M · PICKUP AT HOSTEL 4 ·` with the live countdown of the open batch (or "preorders closed").
  - **Cursor** (mouse only): a dot that grows over links, a DRAG ring over the 3D, a VIEW ring over product cards, the normal text cursor over fields; primary buttons lean toward the pointer.
  - **Red page wipe** (Framer Motion `AnimatePresence`) that names the page being opened. Only plain in-app link clicks play it (not back/forward, forms, new-tab clicks or the admin), and a failsafe never leaves anyone under it.
  - **Headline reveals**: words slide up out of masks, line after line (on load for page titles, on scroll for the rest; the hero waits for the preloader). **Lenis** smooth scroll site-wide.
  - **Add to cart**: the picture lifts off, arcs into the cart button and the badge bumps when it lands (the count only includes it then), plus a haptic tick.
  - **Shop cards**: built with a hover turntable (a shared live-3D canvas); replaced by admin-managed photos, see *Shop photos* below.
  - **Share previews and meta**: OG image (the real hero) and per-product images, app icons, web manifest, `robots.txt`, sitemap, Product JSON-LD; private pages are noindex.
  - **Performance and stability**: the product page loads its 3D viewer when you reach for the picture (or after 4 s on a capable machine) instead of at page load; the home 3D code waits for the poster image; logged-out visitors are redirected in `proxy.ts` before any page renders; fallback fonts are metric-matched to Unbounded, Manrope and JetBrains Mono so the swap moves nothing; streamed pages reserve their height.
  - **Reduced motion**: no preloader, cursor, wipe, Lenis, marquee scroll or reveals; static poster.
  - **Tests**: 73 unit tests; `npm run e2e` (Playwright: add to cart → sign up → checkout → pay page → admin verifies → customer sees it verified); `scripts/polish.mjs` walkthrough of everything above, with layout shift measured on every page at phone and desktop size, logged in and out (0.000 on nearly all, 0.009 at worst); axe clean on every page.
  - **Lighthouse, mobile** (simulated slow 4G + 4× CPU, one run each, Chrome with a GPU on this laptop): Home 85, Shop 90, Product 90, Cart 91, Checkout 90, Login 89, Policies 92; Accessibility 100 on all. SEO reads 63 on cart, checkout, orders and login only because they are deliberately `noindex`.
  - Found and fixed on the way: the preloader's own timer was cancelled by its cleanup (it would have stayed on the page, invisible and blocking clicks); R3F's canvas wrapper took the pointer from the card beneath it; layout shifts from web-font swaps, a login redirect that painted a skeleton first, and unsized skeletons.
- **Left:** deploy and connect the domain (Phase 5), which needs your accounts.
- **Open TODOs:** frame rate and Lighthouse were measured on a laptop with software WebGL or a GPU, not on a ₹12k Android, so re-run PageSpeed Insights on the live URL and try it on a real phone. The font fallbacks are matched to Arial/Helvetica, so a first-ever visit on Android may still move text by a pixel or two.

## Shop photos (spec change after Phase 4) ✅
- **Done:**
  - The shop grid no longer loads the 3D model: cards are plain photos. The shared turntable canvas, its hover wiring and CSS are gone (home and the product page still use the model). `/shop` renders no canvas.
  - Admin → Products → (open one) → **Photos**: add several at once, remove with two taps, up to 8 per product. The first photo is the cover and the second cross-fades in on hover. A product with no photos still shows its studio still (or the tinted glyph), so nothing goes blank.
  - Uploads are shrunk in the browser first (a 4.6 MB phone photo became a 401 KB WebP), then the server decodes and re-encodes everything (JPG, PNG and WebP only; SVG, GIF and anything else refused), turns it upright and drops EXIF/GPS. Stored in a new `product_photos` table (migration `0003`, RLS on, no policies, cascade-deleted with the product) and served by `/photos/<id>` with immutable caching. No storage bucket to set up. Both the demo store and Supabase implement it behind the same `Db` interface.
  - Server Action body limit raised to 4 MB (Vercel's cap is 4.5 MB); `sharp` moved to `dependencies`; `/photos` excluded from `proxy.ts`.
  - 79 unit tests (+6: image processing, photo lifecycle, serving route, SQL privacy and cascade); `npm run e2e` now has 4 tests (admin uploads, card shows it with no canvas, bad file refused, remove restores the studio picture); `polish.mjs` shop and layout-shift sections pass (shop CLS 0.000).
- **Left:** run migration `0003` in Supabase (the README lists it) before the first deploy, or the shop will error when it reads photos.
- **Open TODOs:** the Supabase photo queries are type-checked and the SQL is tested on PGlite, but have never run against a live project (the smoke test now checks the table). No reordering or "make cover" button: to change the cover, remove the photos and re-add them in the order you want.

## Phase 5 — Ship ⏳ (everything that can be done without your accounts is done)
- **Done:**
  - README for the team: the go-live checklist, environment variables, Supabase setup, Vercel deploy and domain, and how to run the shop day to day (change a price, add a product, open a batch, verify a payment, send the vendor sheet, pickup, refunds, reset a password, edit business values), plus a scripts table and troubleshooting.
  - `scripts/smoke-supabase.mjs`: run it once after the Supabase steps. It checks the tables and columns, the seed data, that the public key reads nothing and cannot call the admin function, that *Confirm email* is off, and that the admin can create, log in and reset a customer (it deletes its test customer).
  - `vercel.json` pins the functions to Mumbai (`bom1`); `SITE_URL` added to `.env.example`; Node `>=20.9` declared.
- **Left (needs you):** create the Supabase project and Vercel project, add the environment variables, connect the domain, fill in Admin → Settings, then run `node scripts/smoke-supabase.mjs` and place one real test order.
- **Open TODOs:** the Supabase code paths have only ever run against the in-memory demo store and the PGlite SQL tests, never a live project, so the smoke test above is the first real check. Pickup room and hours, the UPI ID, WhatsApp number, size chart and fabric weight/fit are still placeholders (Admin → Settings).
