# Progress

Short log, one entry per phase: what's done, what's left, open TODOs.

## Phase 0 — Setup ✅
- **Done:** Next.js 16 (Cache Components) + Tailwind 4 scaffold; design tokens, fluid type, film grain, direction-aware buttons; layout shell (nav, footer, cart drawer); model pipeline 43 MB → 1.4 MB (277k tris, silhouette ≥ 99.93%) with headless-WebGL compare/stills renderer; typed `HoodieModel`; Supabase schema + seed (RLS on, validated on a real Postgres engine).
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
