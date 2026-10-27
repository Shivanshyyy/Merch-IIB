"use client";

import Link from "next/link";
import { useSettings } from "@/components/SettingsProvider";
import { Button } from "@/components/ui/Button";
import { fmtDay } from "@/lib/format";
import { normalizeName } from "@/lib/schemas";
import { Countdown } from "./Countdown";
import { useHome, type HomeColorway } from "./store";

export type HomeBatch = { name: string; closesAt: string } | null;

// Each section is tall; its content is pinned (sticky) while the camera moves through that stretch of scroll.
// The wrapper ignores the pointer so you can still drag the 3D hoodie through the gaps; controls opt back in.
function Panel({ shot, index, height, id, children, align = "end" }: { shot: string; index: number; height: number; id?: string; children: React.ReactNode; align?: "end" | "center" }) {
  return (
    <section data-section={index} data-shot={shot} aria-labelledby={id} className="relative" style={{ height: `${height}svh` }}>
      <div className={`sticky top-0 flex h-svh flex-col pt-[var(--nav-h)] ${align === "end" ? "justify-end pb-10 md:pb-16" : "justify-center"}`}>{children}</div>
    </section>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="label mb-4 text-fg">{children}</p>;
const Copy = ({ children }: { children: React.ReactNode }) => <p className="max-w-sm text-[1.02rem] leading-relaxed text-[color-mix(in_srgb,var(--fg)_82%,transparent)]">{children}</p>;

export function Sections({ colorways, batch }: { colorways: HomeColorway[]; batch: HomeBatch }) {
  const s = useSettings();
  const { colorway, setColorway, name, setName } = useHome();
  const printed = normalizeName(name, s);

  return (
    <div data-home-root className="pointer-events-none relative z-10">
      {/* 01 Hero */}
      <Panel shot="hero" index={0} height={100} id="hero-h">
        <div className="shell">
          <Label>{batch ? `[ ${batch.name} ] — Closes ${fmtDay(batch.closesAt)}` : "[ Preorders closed ]"}</Label>
          <h1 id="hero-h" className="t-display text-[clamp(3.1rem,15vw,15rem)] leading-[0.84]">
            Wear
            <br />
            the
            <br />
            campus.
          </h1>
          <div className="mt-8 flex flex-col gap-8 md:mt-12 md:flex-row md:items-end md:justify-between">
            <p className="max-w-sm text-[1.05rem] text-muted">
              Hoodies made for {s.pickupLocation} and everywhere else on campus, with your name on the back.
            </p>
            <div className="pointer-events-auto flex items-center gap-5">
              <Button href="/shop" size="lg">
                Preorder now
              </Button>
              <span className="label hidden items-center gap-2 sm:flex">
                Scroll <span aria-hidden>↓</span>
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* 02 The fabric */}
      <Panel shot="fabric" index={1} height={130} id="fabric-h">
        <div className="shell">
          <div data-copy className="max-w-sm">
            <Label>[ 02 ] — The fabric</Label>
            <h2 id="fabric-h" className="t-display t-h2">
              Made to be worn in
            </h2>
            <div className="mt-5">
              <Copy>Every hoodie is made to order. Here is what the vendor tells us about the cloth.</Copy>
            </div>
            <dl className="mono mt-6 grid gap-px border border-line bg-line text-[0.8rem]">
              {s.fabricSpecs.map((f) => (
                <div key={f.label} className="flex justify-between gap-6 bg-bg/80 p-3 backdrop-blur-sm">
                  <dt className="text-muted">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Panel>

      {/* 03 The details */}
      <Panel shot="cuff" index={2} height={110} id="cuff-h">
        <div className="shell md:flex md:justify-end">
          <div data-copy className="max-w-sm md:text-right">
            <Label>[ 03 ] — The details</Label>
            <h2 id="cuff-h" className="t-display t-h2">
              Cuffs &amp; stitching
            </h2>
            <div className="mt-5 grid gap-3 md:justify-items-end">
              <Copy>Snug ribbed cuffs and hem that keep their shape.</Copy>
              <Copy>Flame outlines stitched in a contrast thread, doubled up so they stand out.</Copy>
            </div>
          </div>
        </div>
      </Panel>
      <Panel shot="hood" index={2} height={110} id="hood-h">
        <div className="shell">
          <div data-copy className="max-w-sm">
            <Label>[ 03 ] — The hood</Label>
            <h2 id="hood-h" className="t-display t-h2">
              Room to spare
            </h2>
            <div className="mt-5">
              <Copy>A full hood that sits high on the neck and drapes when it&apos;s down.</Copy>
            </div>
          </div>
        </div>
      </Panel>

      {/* 04 Make it yours */}
      <Panel shot="back" index={3} height={130} id="name-h">
        <div className="shell">
          <div className="max-w-sm">
            <Label>[ 04 ] — Make it yours</Label>
            <h2 id="name-h" className="t-display t-h2">
              Your name, on the back
            </h2>
            <label className="pointer-events-auto mt-6 block">
              <span className="label mb-2 flex justify-between">
                <span>Try a name</span>
                <span className="mono" aria-live="polite">
                  {printed.length}/{s.nameMaxLength}
                </span>
              </span>
              <input
                className="input"
                value={name}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^A-Za-z .'-]/g, "").replace(/^ +/, "").replace(/ {2,}/g, " ");
                  setName((s.nameUppercase ? cleaned.toUpperCase() : cleaned).slice(0, s.nameMaxLength));
                }}
                maxLength={s.nameMaxLength}
                placeholder="YOUR NAME"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <p className="label mt-3 normal-case tracking-normal">Letters, spaces and . &apos; - only. You&apos;ll set the real one when you order.</p>
          </div>
        </div>
      </Panel>

      {/* 05 Colourways */}
      <Panel shot="colour" index={4} height={130} id="colour-h">
        <div className="shell">
          <Label>[ 05 ] — Colourways</Label>
          <h2 id="colour-h" className="t-display t-h2 max-w-md">
            Pick your colour
          </h2>
          <div className="pointer-events-auto mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Colourway">
            {colorways.map((c) => (
              <button
                key={`${c.slug}-${c.name}`}
                type="button"
                role="radio"
                aria-checked={colorway?.name === c.name && colorway.slug === c.slug}
                onClick={() => setColorway(c)}
                className="chip"
              >
                <span aria-hidden className="size-3.5 rounded-full border border-current/30" style={{ background: c.body, boxShadow: `inset 0 0 0 2px ${c.body}, 0 0 0 1px ${c.stitch}` }} />
                {c.name}
              </button>
            ))}
          </div>
          {colorway && (
            <p className="pointer-events-auto mt-4">
              <Link href={`/shop/${colorway.slug}`} className="label underline underline-offset-4 hover:text-fg">
                Shop the {colorway.name} →
              </Link>
            </p>
          )}
        </div>
      </Panel>

      {/* 06 How it works */}
      <Panel shot="wide" index={5} height={110} id="how-h">
        <div className="shell">
          <Label>[ 06 ] — How it works</Label>
          <h2 id="how-h" className="t-display t-h2 max-w-xl">
            Four steps to yours
          </h2>
          <ol className="mt-6 grid grid-cols-2 border-t border-line bg-bg/40 md:mt-8 md:grid-cols-4">
            {[
              ["Order", "Pick a colour and size, and type the name you want on the back."],
              ["Pay via UPI", "Scan the QR or tap to pay, then send the screenshot on WhatsApp."],
              ["We print in batches", "Verified orders go to the vendor together after the cutoff."],
              ["Pick up", `Collect at ${s.pickupLocation}. We'll message you when it's ready.`],
            ].map(([title, body], i) => (
              <li key={title} className="border-b border-line py-4 pr-4 md:border-b-0 md:border-r md:px-5 md:py-5 md:first:pl-0 md:last:border-r-0">
                <p className="mono text-accent">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="t-display mt-2 text-[0.95rem] tracking-[-0.02em] md:mt-3 md:text-[1.05rem]">{title}</h3>
                <p className="mt-1.5 text-[0.8rem] leading-snug text-muted md:mt-2 md:text-[0.9rem]">{body}</p>
              </li>
            ))}
          </ol>
          {batch && (
            <p className="label mt-6 text-fg">
              {batch.name} closes in <Countdown closesAt={batch.closesAt} className="text-accent-2" />
            </p>
          )}
        </div>
      </Panel>

      {/* 07 CTA */}
      <Panel shot="hero" index={6} height={100} id="cta-h">
        <div className="shell">
          <Label>[ 07 ] — Your turn</Label>
          <h2 id="cta-h" className="t-display text-balance text-[clamp(2.2rem,8.5vw,8rem)] leading-[0.9]">
            {batch ? batch.name : "The next batch"}
            <br />
            {batch ? (
              <>
                closes in <Countdown closesAt={batch.closesAt} className="whitespace-nowrap text-accent" />
              </>
            ) : (
              "opens soon."
            )}
          </h2>
          <div className="pointer-events-auto mt-8">
            <Button href="/shop" size="lg" className="w-full sm:w-auto sm:min-w-[22rem]">
              {batch ? "Preorder now" : "See the hoodies"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
