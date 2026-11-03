import Image from "next/image";
import Link from "next/link";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { Price } from "@/components/shop/Price";
import { whatsappUrl } from "@/config/site";
import { getOpenBatch, getProducts } from "@/lib/catalog";
import { fmtDay } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import type { Product } from "@/lib/types";

export default async function Home() {
  const [products, batch, s] = await Promise.all([getProducts(), getOpenBatch(), getSettings()]);
  const steps = [
    ["01", "Order", "Pick a style, colour and size, then place your preorder."],
    ["02", "Pay via UPI", "Scan the QR or open your UPI app — the amount is prefilled."],
    ["03", "We print in a batch", "Orders close, we send one sheet to the vendor and print together."],
    ["04", `Pick up at ${s.pickupLocation}`, "Collect your order on campus once the batch arrives."],
  ];

  return (
    <>
      {/* Hero: a short wordmark over the cut-out hoodie. The image and CTA both link to the shop. */}
      <section className="shell pt-[calc(var(--nav-h)+clamp(20px,5vw,56px))] pb-[clamp(36px,7vw,80px)] text-center">
        <h1 className="t-display text-[clamp(2.8rem,10vw,7rem)] leading-[0.9] tracking-[-0.045em]">The Drop</h1>
        <Link href="/shop" aria-label="Shop the collection" className="relative mx-auto mt-[clamp(12px,2.5vw,28px)] block aspect-[1073/1226] w-full max-w-[min(480px,78vw)] transition-transform duration-500 ease-[var(--ease)] hover:scale-[1.015]">
          <Image src="/hero/hoodie-back.png" alt="IIT Bombay hoodie, back print" fill priority sizes="(min-width: 768px) 480px, 78vw" className="object-contain" />
        </Link>
        <div className="mt-[clamp(8px,2vw,20px)]">
          <Link href="/shop" className="btn btn-lg">
            Preorder now <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Products — showcase only, no buying flow here. */}
      <section aria-labelledby="collection" className="hair-t">
        <div className="shell flex items-baseline justify-between gap-4 py-8">
          <h2 id="collection" className="t-display text-[clamp(1.4rem,3.4vw,2.4rem)] tracking-[-0.03em]">
            The Collection
          </h2>
          <span className="label">{products.length} {products.length === 1 ? "style" : "styles"}</span>
        </div>
        <div className="grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <ShowcaseCard key={p.id} product={p} index={i} />
          ))}
          {products.length === 0 && <p className="shell py-16 text-muted">New drops coming soon.</p>}
        </div>
      </section>

      {/* Important details */}
      <section aria-labelledby="details" className="hair-t">
        <div className="shell py-[clamp(48px,8vw,96px)]">
          <p className="label mb-3">[ Good to know ]</p>
          <h2 id="details" className="t-display mb-12 text-[clamp(1.6rem,4vw,2.8rem)] tracking-[-0.03em]">
            How it works
          </h2>
          <ol className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([n, title, body]) => (
              <li key={n} className="bg-bg p-6">
                <span className="mono text-sm text-muted">{n}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>

          <dl className="mt-12 grid gap-10 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-3">
            <Detail term="Pickup">
              {s.pickupLocation}
              {s.pickupRoom ? `, ${s.pickupRoom}` : ""}
              <br />
              {s.pickupHours}
            </Detail>
            <Detail term="Returns">
              Refunds within {s.refundWindowDays} days of pickup for defective, misprinted or wrong items. Personalised pieces can&rsquo;t be returned for change of mind.
            </Detail>
            <Detail term="Made to order">
              Every piece is printed per batch — double-check your name spelling and size before paying.
            </Detail>
            {batch && (
              <Detail term="Current batch">
                {batch.name}
                <br />
                Closes {fmtDay(batch.closes_at)}
                {batch.est_delivery ? ` · ${batch.est_delivery}` : ""}
              </Detail>
            )}
            <Detail term="Payment">UPI only — pay to {s.upiId.includes("TODO") ? "the UPI ID shown at checkout" : s.upiId}.</Detail>
            <Detail term="Need help?">
              Message {s.contactName} on{" "}
              <a href={whatsappUrl(s.whatsapp, "Hi, I have a question about merch.")} className="underline underline-offset-4 hover:text-fg" rel="noopener">
                WhatsApp
              </a>
              .
            </Detail>
          </dl>
        </div>
      </section>
    </>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label mb-2">{term}</dt>
      <dd className="text-sm leading-relaxed text-muted [&_a]:text-fg">{children}</dd>
    </div>
  );
}

// A product tile linking to its page: image, name, colour dots, price.
function ShowcaseCard({ product, index }: { product: Product; index: number }) {
  const first = product.colorways[0];
  const cover = product.photos[0];
  return (
    <Link href={`/shop/${product.slug}`} className="group relative block border-b border-line sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0">
      <div className="relative aspect-[4/5] overflow-hidden bg-bg-2">
        {cover ? (
          <Image src={photoUrl(cover)} alt={product.name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 ease-[var(--ease)] group-hover:scale-[1.04]" />
        ) : (
          <ColorwayImage slug={product.slug} colorway={first.name} body={first.body} stitch={first.stitch} view="front" alt={`${product.name} in ${first.name}`} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover object-top transition-transform duration-700 ease-[var(--ease)] group-hover:scale-[1.04]" />
        )}
        <span className="mono absolute right-4 top-4 text-[0.7rem] leading-none text-muted">[{String(index + 1).padStart(2, "0")}]</span>
      </div>
      <div className="flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="t-display text-[1.05rem] tracking-[-0.025em]">{product.name}</h3>
          <div className="mt-3 flex items-center gap-2">
            {product.colorways.map((c) => (
              <span key={c.name} title={c.name} className="size-3.5 rounded-full border border-line" style={{ background: c.body }} />
            ))}
            <span className="label ml-1">{product.colorways.length === 1 ? "1 colour" : `${product.colorways.length} colours`}</span>
          </div>
        </div>
        <Price product={product} badge={false} />
      </div>
    </Link>
  );
}
