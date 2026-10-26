import Image from "next/image";
import { Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { getOpenBatch } from "@/lib/catalog";
import { fmtDay } from "@/lib/format";
import { getSettings } from "@/lib/settings";

// Static hero for now. Phase 3 swaps the poster for the live 3D scene and keeps this as the WebGL-failure fallback.
const steps = (pickup: string) =>
  [
    ["Order", "Pick a colour and size, and type the name you want on the back."],
    ["Pay via UPI", "Scan the QR or tap to pay. Send the screenshot on WhatsApp."],
    ["We print in batches", "Verified orders go to the vendor together after the cutoff."],
    ["Pick up", `Collect at ${pickup}. We'll message you when it's ready.`],
  ] as const;

export default async function Home() {
  const s = await getSettings();
  return (
    <>
      <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden pt-[var(--nav-h)]">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_62%_46%,rgba(255,59,31,0.45),transparent_70%),radial-gradient(40%_30%_at_20%_100%,rgba(255,181,71,0.08),transparent_70%)]" />
        <div className="pointer-events-none absolute right-[-12vw] top-[12svh] -z-[5] aspect-square w-[118vw] max-w-[1000px] md:right-[2vw] md:top-[8svh] md:w-[56vw]">
          <Image src="/products/midnight-flame-midnight-front.webp" alt="A black hoodie with red flame stitching" fill priority sizes="(min-width: 768px) 56vw, 118vw" className="object-contain" />
        </div>

        <div className="shell pb-10 md:pb-14">
          <p className="label mb-6 text-fg">
            <Suspense fallback="[ Preorder ]">
              <BatchLabel />
            </Suspense>
          </p>
          <h1 className="t-display text-[clamp(3.1rem,15vw,15rem)] leading-[0.84]">
            Wear
            <br />
            the
            <br />
            campus.
          </h1>
          <div className="mt-8 flex flex-col gap-8 md:mt-12 md:flex-row md:items-end md:justify-between">
            <p className="max-w-sm text-[1.05rem] text-muted">Hoodies made for {s.pickupLocation} and everywhere else on campus, with your name on the back.</p>
            <div className="flex items-center gap-5">
              <Button href="/shop" size="lg">
                Preorder now
              </Button>
              <span className="label hidden items-center gap-2 sm:flex">
                Scroll <span aria-hidden>↓</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-h" className="border-t border-line">
        <div className="shell py-20 md:py-32">
          <p className="label">[ 06 ] — How it works</p>
          <h2 id="how-h" className="t-display t-h1 mt-4 max-w-[14ch]">
            Four steps to yours
          </h2>
          <ol className="mt-14 grid border-t border-line md:grid-cols-4">
            {steps(s.pickupLocation).map(([title, body], i) => (
              <li key={title} className="border-b border-line py-8 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
                <p className="mono text-accent">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="t-display mt-5 text-[1.15rem] tracking-[-0.02em]">{title}</h3>
                <p className="mt-3 text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label="Preorder" className="ember border-t border-line">
        <div className="shell flex flex-col items-start gap-10 py-24 md:py-36">
          <h2 className="t-display text-[clamp(2.4rem,9vw,8rem)]">
            Batch 01
            <br />
            is open.
          </h2>
          <Button href="/shop" size="lg">
            See the hoodies
          </Button>
        </div>
      </section>
    </>
  );
}

async function BatchLabel() {
  const batch = await getOpenBatch();
  return batch ? (
    <>
      [ {batch.name} ] — Closes {fmtDay(batch.closes_at)}
    </>
  ) : (
    <>[ Preorders closed ]</>
  );
}
