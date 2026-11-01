"use client";

import Image from "next/image";
import Link from "next/link";
import { BackName } from "@/components/shop/BackName";
import { nameSpot } from "@/lib/name-spots";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { useSettings } from "@/components/SettingsProvider";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { fmtDay } from "@/lib/format";
import { normalizeName } from "@/lib/schemas";
import { FreebiesBanner } from "@/components/promo/FreebiesBanner";
import type { PromoView } from "@/lib/promo";
import { Countdown } from "./Countdown";
import { useHome, type HomeColorway } from "./store";

export type HomeBatch = { name: string; closesAt: string } | null;
export type HomePhoto = { src: string; alt: string; slug: string } | null;

// Plain sections in normal page flow: nothing pinned, nothing hijacking the scroll.
function Panel({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`border-b border-line py-16 md:py-24 ${className}`}>
      {children}
    </section>
  );
}

// The back print of the picked colourway, with the typed name (or a faint placeholder) where it gets printed.
function Preview({ printed }: { printed: string }) {
  const colorway = useHome((s) => s.colorway);
  const spot = colorway ? nameSpot(colorway.slug) : null;
  if (!colorway) return null;
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-bg-2 [container-type:inline-size]">
      <ColorwayImage slug={colorway.slug} colorway={colorway.name} body={colorway.body} stitch={colorway.stitch} view="back" alt={`${colorway.name} hoodie, back print`} sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
      {spot && <BackName name={printed} spot={spot} body={colorway.body} ink={colorway.stitch} />}
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="label mb-4 text-fg">{children}</p>;
const Copy = ({ children }: { children: React.ReactNode }) => <p className="max-w-sm text-[1.02rem] leading-relaxed text-[color-mix(in_srgb,var(--fg)_82%,transparent)]">{children}</p>;

export function Sections({ colorways, batch, hero, promo }: { colorways: HomeColorway[]; batch: HomeBatch; hero: HomePhoto; promo: PromoView | null }) {
  const s = useSettings();
  const { colorway, setColorway, name, setName } = useHome();
  const printed = normalizeName(name, s);

  return (
    <div className="relative">
      {/* 01 Hero */}
      <section aria-labelledby="hero-h" className="border-b border-line pb-12 pt-[calc(var(--nav-h)+2rem)] md:pb-20">
        <div className="shell grid items-center gap-10 md:grid-cols-2">
          <div>
            <Label>{batch ? `[ ${batch.name} ] — Closes ${fmtDay(batch.closesAt)}` : "[ Preorders closed ]"}</Label>
            <Reveal as="h1" id="hero-h" trigger="load" className="t-display text-[clamp(3.1rem,15vw,6rem)] md:text-[clamp(3rem,6.8vw,7rem)] leading-[0.84]">
              {"Wear\nthe\ncampus."}
            </Reveal>
            <p className="mt-8 max-w-sm text-[1.05rem] text-muted">Hoodies and tees made for {s.pickupLocation} and everywhere else on campus, with your name on the back.</p>
            <div className="mt-8">
              <Button href="/shop" size="lg">
                Preorder now
              </Button>
            </div>
          </div>
          <Link href={hero ? `/shop/${hero.slug}` : "/shop"} className="relative block aspect-[4/5] overflow-hidden bg-bg-2 md:aspect-square">
            {hero ? (
              <Image src={hero.src} alt={hero.alt} fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
            ) : colorway ? (
              <ColorwayImage slug={colorway.slug} colorway={colorway.name} body={colorway.body} stitch={colorway.stitch} alt={`${colorway.name} hoodie`} priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover object-top" />
            ) : null}
          </Link>
        </div>
      </section>

      {promo && <FreebiesBanner promo={promo} />}

      {/* 02 The fabric */}
      <Panel id="fabric-h">
        <div className="shell">
          <div className="max-w-sm">
            <Label>[ 02 ] — The fabric</Label>
            <Reveal as="h2" id="fabric-h" className="t-display t-h2">
              Made to be worn in
            </Reveal>
            <div className="mt-5">
              <Copy>Our hoodies are heavyweight cotton fleece, soft on the inside. Tees are 100% cotton: 240 GSM oversized, 210 GSM regular.</Copy>
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
      <Panel id="cuff-h">
        <div className="shell grid gap-12 md:grid-cols-2">
          <div className="max-w-sm">
            <Label>[ 03 ] — The details</Label>
            <Reveal as="h2" id="cuff-h" className="t-display t-h2">
              Cuffs &amp; stitching
            </Reveal>
            <div className="mt-5 grid gap-3">
              <Copy>Snug ribbed cuffs and hem that keep their shape.</Copy>
              <Copy>The emblem and your name come in a contrast colour, so they stand out.</Copy>
            </div>
          </div>
          <div className="max-w-sm">
            <Label>[ 03 ] — The hood</Label>
            <h3 className="t-display t-h2">Room to spare</h3>
            <div className="mt-5">
              <Copy>A full hood that sits high on the neck and drapes when it&apos;s down.</Copy>
            </div>
          </div>
        </div>
      </Panel>

      {/* 04 Make it yours */}
      <Panel id="name-h">
        <div className="shell grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          <div className="max-w-sm">
            <Label>[ 04 ] — Make it yours</Label>
            <Reveal as="h2" id="name-h" className="t-display t-h2">
              Your name, on the back
            </Reveal>
            <label className="mt-6 block">
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
            <p className="label mb-3 mt-8">Pick your colour</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colourway">
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
              <p className="mt-4">
                <Link href={`/shop/${colorway.slug}`} className="label underline underline-offset-4 hover:text-fg">
                  Shop the {colorway.name} →
                </Link>
              </p>
            )}
          </div>
          <Preview printed={printed} />
        </div>
      </Panel>

      {/* 05 How it works */}
      <Panel id="how-h">
        <div className="shell">
          <Label>[ 05 ] — How it works</Label>
          <Reveal as="h2" id="how-h" className="t-display t-h2 max-w-xl">
            Four steps to yours
          </Reveal>
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

      {/* 06 CTA */}
      <Panel id="cta-h">
        <div className="shell">
          <Label>[ 06 ] — Your turn</Label>
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
          <div className="mt-8">
            <Button href="/shop" size="lg" className="w-full sm:w-auto sm:min-w-[22rem]">
              {batch ? "Preorder now" : "See the drop"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
