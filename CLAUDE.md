# CLAUDE.md: IITB Merch Store

A preorder storefront for personalized campus hoodies (and later T-shirts) sold to IIT Bombay students by a team of 4 friends.
We do not print anything ourselves. We collect orders and payments, send one batch sheet to a vendor, receive the finished items, and students pick them up at Hostel 4.

**The bar:** this should feel like an Awwwards Site of the Day, not a template store. It should look cinematic and tactile and be fast on a ₹12k Android phone over hostel Wi‑Fi. Every interaction should have a small moment of delight. If something looks "default", it isn't done.

---

## 1. Ground rules for Claude Code

- **Plan first.** For any phase, outline the files and steps, then build. After each phase, run `npm run build` and fix every error and warning before moving on.
- **Verify visually.** After UI work, start the dev server and take Playwright screenshots at 390×844 (phone) and 1440×900 (desktop). Look at them and fix what looks off.
- **Keep comments short.** Code comments should be one line and only where the *why* isn't obvious.
- **Use TypeScript strict mode.** No `any` unless it's unavoidable and has a one-line reason.
- **Never trust the client for money.** Prices and totals are always recalculated on the server from the database.
- **No secrets in client code.** The Supabase service-role key and the admin password live only in server code and env vars.
- **Ask, don't invent,** for business facts: UPI ID, phone numbers, prices, sizes, dates. Use the placeholders in `src/config/site.ts` and flag them.
- **Commit at the end of each phase** with a clear message.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript + React Server Components |
| Styling | Tailwind CSS + CSS variables for design tokens |
| 3D | three.js, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` |
| Motion | GSAP + ScrollTrigger (scroll choreography), Lenis (smooth scroll), Framer Motion (UI micro-interactions and page transitions) |
| State | Zustand with `persist` for the cart (localStorage) |
| Database | Supabase Postgres (RLS on), accessed only from server actions and route handlers |
| Validation | Zod, shared by client and server |
| QR codes | `qrcode` (generate the UPI QR per order, with the amount filled in) |
| Admin auth | Single password in an env var, signed with `jose` into an httpOnly cookie; middleware guards `/admin` |
| Hosting | Vercel |

---

## 3. Single config file: `src/config/site.ts`

All business constants live here, so non-coders on the team can edit them:

```ts
export const site = {
  brand: "MERCH—IITB",            // placeholder; final name TBD
  domain: "TBD",                 // e.g. merch-iitb.shop
  upi: { id: "TODO@upi", payeeName: "Aryan TODO" },
  contact: { name: "Aryan", phone: "91XXXXXXXXXX", whatsapp: "91XXXXXXXXXX" },
  pickup: { location: "Hostel 4", room: "TODO", hours: "TODO" },
  refundWindowDays: 5,
  nameMaxLength: 12,
  maxPendingOrdersPerEmail: 3,
  orderCodePrefix: "HD",
  modelCredit: { title: "Classic Black Flame Hoodie", author: "kril", url: "https://sketchfab.com/3d-models/classic-black-flame-hoodie-0fd0effa321e456cb2a7467e2899b658", license: "CC BY 4.0" },
} as const;
```

---

## 4. The 3D hoodie model

- **Source file:** `assets-raw/hoodie.glb` (43 MB, from Sketchfab). Never serve this file directly.
- **License:** CC BY 4.0 by **kril**. A visible credit is required, so put it in the footer and on the policies page, using `site.modelCredit`.
- **Structure:**
  - Materials: `Rib_2X2_468gsm_hoodie_end` (cuffs and waistband), `Sweat_Rib_1X1_319gsm_hoodie` (body), `Sweat_hood_Rib_1X1_319gsm_hood` (hood), `stitches` (red, roughness 0).
  - The three fabric materials share one small base-colour texture, plus a roughness/metal texture and a normal map.
  - The textures are tiny (~750 KB total). Nearly all of the 43 MB is geometry.
- **Optimise once with a script** (`scripts/optimize-model.mjs`, using `@gltf-transform/cli`): dedup → weld → simplify (aim for about 25% of triangles, then check the silhouette and seams visually) → meshopt compression → textures to WebP at ≤1024px. Output to `public/models/hoodie.glb`.
  - **Budget:** ≤ 4 MB, and ideally under 2.5 MB.
  - Also generate a `gltfjsx --types` component in `src/components/three/HoodieModel.tsx`.
- **Colourways:** the base texture is black, and multiplying a colour onto black stays black. So for each colourway, set `map = null` and set `material.color` to the colourway hex. Keep the normal and roughness maps so the knit detail survives. Stitch colour is part of each colourway too (e.g. black body with red stitches, grey body with black stitches).
  - Animate colour changes: lerp the colours over about 600 ms, never snap.
- **Positioning:** wrap the model in drei `<Center>`, since the raw bounds aren't centred. Set the scale so the hoodie fills about 55% of the viewport height in the hero.

---

## 5. Design direction

**Mood:** a midnight studio by Powai lake. Dark, cinematic and warm, with the hoodie lit like a product launch. The black-and-red "flame" model sets the accent colour.

- **Tokens:**
  - `--bg #0A0A0B`, `--bg-2 #121214`, `--fg #EDEBE6`, `--muted #8A8780`, `--accent #FF3B1F` (flame red), `--accent-2 #FFB547` (ember), `--line rgba(237,235,230,.12)`
- **Type** (via `next/font/google`):
  - Display: **Unbounded** (huge, tight tracking, uppercase hero words)
  - Body: **Manrope**
  - Mono: **JetBrains Mono** for prices, order codes, sizes and labels
  - Use a fluid type scale with `clamp()`. Hero words should be 14–18vw on mobile.
- **Texture:** a subtle animated film-grain overlay (CSS/SVG noise at 4–6% opacity) over the whole site.
- **Layout:** a strong grid with hairline dividers, small mono labels like `[01] — THE FABRIC`, generous whitespace, and asymmetric compositions.
- **Signature details:**
  - **Preloader:** shows real model-loading progress as a 000→100 mono counter, then the counter splits apart to reveal the scene.
  - **Custom cursor (desktop only):** a small dot. It grows into a "DRAG" ring over the canvas and a "VIEW" ring over product cards, and is magnetic on primary buttons.
  - **Text reveals:** split headlines into lines and words, which slide up from masks as they enter the viewport.
  - **Page transitions:** a red wipe, or the counter, between routes using Framer Motion `AnimatePresence`.
  - **Marquee strip:** `PREORDER BATCH 01 · CLOSES IN 03D 14H 22M · PICKUP AT HOSTEL 4 ·` with a live countdown from the active batch.
  - **Buttons:** hover fills from the cursor's entry direction, with press scale 0.97.
  - **Add to cart:** a small hoodie thumbnail flies into the cart icon, and the cart badge bumps.
  - **Haptic-feel feedback:** `navigator.vibrate(10)` on mobile for add-to-cart and copying the UPI ID.
- **Accessibility:**
  - Everything works with the keyboard, focus rings are visible, and contrast meets AA.
  - If `prefers-reduced-motion` is set, disable auto-orbit, Lenis and the big transitions, and show a static hero render.

---

## 6. Home page: the 3D experience (`/`)

**Canvas:** one fixed, full-screen `<Canvas>` behind the HTML sections (`position: fixed; inset: 0; z-index: 0`). The HTML scrolls over it.

**Scene background** (never a flat colour):
- Deep gradient backdrop: a large inverted sphere or a shader plane from `#0A0A0B` to a faint red-ember glow behind the hoodie.
- `fog` that fades the floor into darkness.
- Floor: `MeshReflectorMaterial`, dark and slightly rough, so the hoodie has a soft, blurred reflection.
- `ContactShadows` under the hoodie.
- Floating ember particles: drei `<Sparkles>` in accent colours, slow, with a small count on mobile.
- Lighting:
  - Studio-style `<Environment preset="city">` at low intensity, or a custom Lightformer rig.
  - A warm key light, plus a red rim light from behind-left that outlines the silhouette.
- Post-processing (desktop only):
  - Subtle Bloom (on the stitches and embers)
  - Vignette
  - Light noise
  - Skip post-processing entirely when `PerformanceMonitor` reports a weak device.

**Motion:**
- **Idle (default):** the camera orbits the hoodie automatically, a full circle in about 40 s, with a gentle vertical bob of ±0.15. The hoodie itself rotates slowly the other way (about 0.08 rad/s) and floats using drei `<Float>` (low intensity).
- **Interaction:**
  - The user can drag to orbit (`OrbitControls`, damping on, no pan, zoom clamped, polar angle limited so you can't go under the floor).
  - When the user drags, auto-orbit pauses.
  - Auto-orbit resumes after 3 s idle, blending back smoothly with damping and no jumps.
  - Double-tap or double-click resets the view with an eased tween.
- **Scroll choreography** (GSAP ScrollTrigger scrubbed against the HTML sections; the camera moves between named "shots" using eased position and target tweens):

| # | Section | Camera shot | Overlay content |
|---|---|---|---|
| 01 | Hero | Wide orbit (idle mode) | Huge split headline, e.g. "WEAR THE CAMPUS." Subline, primary CTA "Preorder now", scroll cue |
| 02 | The Fabric | Push in close on the body knit | Mono spec labels with thin leader lines pinned to 3D points (drei `<Html>`), e.g. "Brushed fleece", "Heavyweight". **Spec numbers must come from the vendor, so keep placeholders until confirmed** |
| 03 | The Details | Swing to the cuff/rib, then the hood | Callouts for rib cuffs, double stitching and the hood. Bloom makes the red stitches glow faintly |
| 04 | Make it yours | Back of the hoodie, square-on | A live name preview: the typed name renders on the back using a CanvasTexture decal in a chosen font, clamped to `nameMaxLength`. If decals are flaky, fall back to a 2D overlay mockup |
| 05 | Colourways | Three-quarter view, slow spin | Colour chips; selecting one animates the material colours. The scene's rim light shifts to complement each colourway |
| 06 | How it works | Pull back wide | 4 steps: Order → Pay via UPI → We print in batches → Pick up at Hostel 4, plus the batch countdown |
| 07 | CTA | Hero framing again (loops visually) | "Batch 01 closes in …" with a giant button to `/shop` |

When the user leaves Home, the canvas unmounts or pauses (`frameloop="demand"`), so it doesn't drain battery on other pages.

**Performance:**
- `dpr={[1, 1.75]}`.
- Use `PerformanceMonitor` to lower the DPR or switch off the reflector and post-processing.
- Lazy-load the canvas with `next/dynamic` and `ssr: false`.
- Preload the GLB with `useGLTF.preload`.
- If WebGL fails, show the static poster image.

---

## 7. Store flow and pages

All prices are in **₹ whole rupees**, displayed in mono, e.g. `₹999`.

1. **`/shop`:** a grid of product cards from the `products` table.
   - Each card shows the name, price and colour dots.
   - On hover (desktop), the card's still render cross-fades into a slow 360° turntable (a pre-rendered image sequence or a small shared canvas).
   - Badge: "Batch 01 · preorder".
2. **`/shop/[slug]`** (product detail):
   - Left: a 3D viewer using the same model, with this product's colourways and drag to rotate.
   - Right: colour, size (with a size-chart modal), a **name personalization** field, and quantity.
   - **Name field:** shows a live character count, allows letters, spaces and `.'-` only, auto-uppercases if the design needs it, and previews on the 3D back.
   - Show the price, the batch cutoff and the estimated delivery window.
   - Add to cart.
3. **`/cart`:** a slide-over drawer from any page, plus a full page.
   - Line items show colour, size, name and quantity, with remove and edit.
   - Subtotal.
   - Note: "Made to order. Double-check name spelling."
4. **`/checkout`:**
## Customer accounts (Supabase Auth)
-## Customer accounts (Supabase Auth, email + password)
- Sign up / log in with email + password only. Email is the user's unique ID.
- NO email verification, NO OTP, NO magic links, NO Google. "Confirm email" is turned OFF
  in Supabase Auth settings, and the app never sends any email.
- Sign-up form collects: full_name (required), email (required), password (min 8),
  phone (required, 10-digit), roll_no (optional), default_size (optional).
  User is logged in immediately after sign-up.
- `profiles(id uuid pk = auth.users.id, email citext unique, full_name, phone, roll_no,
  default_size, created_at)`; RLS: users read/update only their own row.
- Forgot password: no email reset. Show "Message Aryan on WhatsApp" link; Aryan sets a
  new password from admin.
- Browsing shop + cart works logged out; login required at checkout (cart survives login).
  Checkout prefills from profile, size defaults to default_size.
- `orders` gets `user_id` fk; `/orders` ("My orders") lists their orders with status timeline.
  Replace the email+code `/track` page with this.
- `/account` page to edit profile and change password.
- Admin: customers list (search by name/email/roll no/phone), view a customer's orders,
  edit their profile, and **reset their password** (server action using the service role).
  Admin login stays separate (ADMIN_PASSWORD).
- Account menu in nav: avatar initial, My orders, Account, Log out.
- Admin: customers list (search by name/email/roll no/phone), view a customer's orders,
- Account menu in nav: avatar initial, My orders, Account, Log out.
   - Required checkboxes:
     - "I confirmed the name spelling and sizes"
     - "I've read the refund & pickup policy" (linked)
   - Add a honeypot field.
   - Submitting calls a server action that:
     1. Validates with Zod.
     2. Re-prices from the DB.
     3. Checks the batch is open.
     4. Checks the pending-order limit per email.
     5. Creates the order with `payment_status = pending`.
     6. Generates the order code (e.g. `HD-7K4Q`; no ambiguous characters like 0/O or 1/I).
     7. Redirects to the payment page.
5. **`/order/[code]/pay`** (the payment instructions page):
   - Big order code and total.
   - **Policy box:**
     - Refund eligible within **5 days** of pickup for defective, misprinted or wrong items. **Don't write "no returns" anywhere.** Personalized items may not be eligible for change-of-mind returns, and the page should say so clearly.
     - Collection and returns happen at **Hostel 4** (room and hours from config).
   - **QR code:** generated on the server from `upi://pay?pa={id}&pn={payee}&am={total}&cu=INR&tn={orderCode}`. The amount is filled in and the order code goes in the payment note.
   - **UPI ID** with a copy button (shows a "Copied" toast, with a tick morph animation).
   - **"Open UPI app" button** using the same `upi://` link. This works on mobile; on desktop, show a hint to scan the QR instead.
   - **Aryan's number** with buttons for tap-to-call (`tel:`) and **WhatsApp** (`https://wa.me/{number}?text=` with "Hi, I paid ₹{total} for order {code}. Screenshot attached." filled in).
   - An optional **UTR / transaction ID** field the customer can submit. It's saved to the order to make verification faster.
   - Clear steps: 1) Pay 2) Send the screenshot on WhatsApp 3) Check your status.
6. **`/track`** (order status):
   - The customer enters their email and one order code. This shows **all orders for that email**: items, total, and a status timeline (Placed → Payment verified → In production → Ready for pickup → Collected), plus refund status if any.
   - Requiring the order code stops strangers from looking people up by email alone.
   - Remember the last lookup in localStorage for convenience.
7. **`/policies`:** refunds and returns, pickup, made-to-order terms, privacy (what we store and why; we only share name, size and personalization with the vendor), and model credit.
8. **`/404`:** a custom page, e.g. the hoodie falling off-screen, plus a "back to shop" link.

**Help line on every page:** a footer note saying "Messed up something? Message Aryan on WhatsApp" with the link. There's no login, so Aryan fixes problems manually from the admin panel.

---

## 8. Admin panel (`/admin`)

This is protected by middleware, with a login page at `/admin/login` that takes the password from the `ADMIN_PASSWORD` env var. It sets a signed httpOnly cookie that lasts 7 days. Everything below goes through server actions that check the cookie.

- **Orders table:**
  - Search by code, email, name or phone.
  - Filter by payment status, order status and batch.
  - Sort by date.
  - Rows are colour-coded by status.
- **Order drawer:** full details, items, UTR, and quick actions:
  - **Verify payment**, which sets `verified_at`
  - Reject payment
  - Move to production, ready or collected
  - Start or finish a refund
  - Edit the name spelling or size (logged)
  - Admin note
  - Every action writes a row to `order_events`, the audit log.
- **One-tap WhatsApp to customer** with a pre-written message for each status, e.g. "Your order HD-7K4Q is ready at Hostel 4…".
- **Batch management:** create a batch, open or close it, set its cutoff and estimated delivery, and see the active batch's stats.
- **Vendor export:** download a CSV of verified orders in a batch, with columns product, colour, size, name, quantity and order code only. **No phone, email or payment data.** Also show a summary pivot: counts by product × colour × size.
- **Dashboard tiles:** orders, verified revenue, pending verifications, refunds, and items per size.
- **Products CRUD:** name, slug, type, description, price, colourways (name + body hex + stitch hex), sizes, active, sort order.
- **Settings (`/admin/settings`):** every business value is editable here and stored in the `settings` table (one row, JSON). The site reads it through `getSettings()`; `src/config/site.ts` and `supabase/seed.json` only hold the defaults and fixed constants (order-code prefix, model credit).
  - Editable: brand name, UPI ID + payee name, contact name / phone / WhatsApp, pickup location / room / hours, refund window (days), name max length + capitals, max pending orders per email, size chart, fabric specs.
  - Saving takes effect immediately (cache tags are invalidated).
  - A setup checklist on the dashboard lists values still on placeholders. In production the pay page refuses to show a QR while the UPI ID is still the placeholder.
- **Customers:** see "Customer accounts" above.
- The admin panel should be clean and functional (it can be lighter on animation), dark-themed and usable on a phone, since Aryan will use it from his phone.

---

## 9. Database (Supabase): `supabase/migrations/*.sql`

```
products(id uuid pk, slug text unique, name text, type text check in ('hoodie','tee'),
  description text, price_inr int, colorways jsonb, sizes text[], personalizable bool default true,
  active bool default true, sort int default 0, created_at timestamptz default now())

batches(id uuid pk, name text, opens_at timestamptz, closes_at timestamptz,
  est_delivery text, status text check in ('open','closed','ordered','received','done'))

orders(id uuid pk, code text unique, batch_id uuid fk, email citext, full_name text, phone text,
  hostel text, room text, items jsonb, total_inr int, utr text,
  payment_status text check in ('pending','verified','rejected') default 'pending',
  order_status text check in ('placed','in_production','ready','collected','cancelled') default 'placed',
  refund_status text check in ('none','requested','approved','refunded') default 'none',
  admin_note text, verified_at timestamptz, created_at timestamptz default now())

order_events(id bigserial pk, order_id uuid fk, type text, note text, created_at timestamptz default now())
```

- RLS is enabled on every table with **no public policies**. The site reads and writes only through the server with the service role.
- Index `orders(email)`, `orders(code)` and `orders(batch_id, payment_status)`.
- Add seed data with 3 hoodie products and 1 open batch, so the site is demoable on day one.

---

## 10. Quality bar (definition of done)

- **Lighthouse (mobile):**
  - Shop, product, checkout and track pages: Performance ≥ 85, Accessibility ≥ 95.
  - Home: Performance ≥ 70 is acceptable because of the 3D.
- Home's first meaningful paint should come in under 2.5 s on fast 4G, with the preloader covering model loading.
- No layout shift on any page.
- 60 fps orbit on a mid-range laptop and smooth on a mid-range Android.
- A full order flow (add to cart → checkout → pay page → admin verify → track shows verified) passes as a Playwright e2e test.
- All forms have inline Zod errors, plus loading and disabled states.
- Empty states (empty cart, no orders found) are designed, not blank.
- Proper meta, OG image and favicon.

---

## 11. Build phases

1. **Phase 0 – Setup:**
   - Scaffold Next.js, Tailwind, fonts, design tokens, grain and the layout shell (nav, footer, cart drawer).
   - Write `site.ts`.
   - Write and run the model optimisation script.
   - Set up the Supabase schema and seed data, plus `.env.example`.
2. **Phase 1 – Commerce core** (no 3D yet): shop, product page (with a static image), cart, checkout server action, pay page with QR, track page and policies.
3. **Phase 2 – Admin:** login, orders table, order drawer actions, audit log, batches, CSV export and dashboard.
4. **Phase 3 – The 3D home:** scene, background, idle orbit, drag interaction, scroll shots 01–07, colourways and the name decal.
5. **Phase 4 – Polish:** preloader, cursor, page transitions, text reveals, marquee, add-to-cart fly, reduced-motion and fallbacks, performance pass, e2e test, and Lighthouse.
6. **Phase 5 – Ship:**
   - Deploy to Vercel and connect the domain.
   - Write a README for the team covering how to change prices, open a batch and verify payments.
