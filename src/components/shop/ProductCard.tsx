import Image from "next/image";
import Link from "next/link";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { Price } from "@/components/shop/Price";
import { discountPercent } from "@/lib/discount";
import { photoUrl } from "@/lib/photos";
import type { Product } from "@/lib/types";

const SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
const FADE = "transition-all duration-700 ease-[var(--ease)] group-hover:scale-[1.04]";

export function ProductCard({ product, index, badge, priority = false }: { product: Product; index: number; badge: string | null; priority?: boolean }) {
  const first = product.colorways[0];
  const [cover, second] = product.photos;
  return (
    <Link href={`/shop/${product.slug}`} data-cursor="view" className="group relative block border-b border-line sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0">
      <div className="relative aspect-[4/5] overflow-hidden bg-bg-2">
        {cover ? (
          // Photos the admin uploaded: the cover, and the second one fades in on hover.
          <>
            <Image src={photoUrl(cover)} alt={`${product.name}`} fill priority={priority} sizes={SIZES} className={`object-cover ${FADE} ${second ? "group-hover:opacity-0" : ""}`} />
            {second && <Image src={photoUrl(second)} alt="" fill sizes={SIZES} className={`object-cover opacity-0 ${FADE} group-hover:opacity-100`} />}
          </>
        ) : (
          // No uploads yet: the studio photos (front, and the back print on hover), or a tinted hoodie glyph.
          <>
            <ColorwayImage
              slug={product.slug}
              colorway={first.name}
              body={first.body}
              stitch={first.stitch}
              view="front"
              alt={`${product.name} in ${first.name}, front`}
              priority={priority}
              sizes={SIZES}
              className={`object-cover object-top ${FADE} group-hover:opacity-0`}
            />
            <ColorwayImage slug={product.slug} colorway={first.name} body={first.body} stitch={first.stitch} view="back" alt="" sizes={SIZES} className={`object-cover opacity-0 ${FADE} group-hover:opacity-100`} />
          </>
        )}
        <span className="label absolute left-4 top-4 border border-line bg-bg/70 px-2 py-1.5 backdrop-blur-sm">{badge ?? "Preorder"}</span>
        {discountPercent(product) > 0 && <span className="label absolute bottom-4 left-4 bg-accent px-2 py-1.5 text-bg">Sale · {discountPercent(product)}% off</span>}
        <span className="mono absolute right-4 top-4 border border-line bg-bg/70 px-2 py-1.5 text-[0.7rem] leading-none text-fg backdrop-blur-sm">[{String(index + 1).padStart(2, "0")}]</span>
      </div>
      <div className="flex items-end justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="t-display text-[1.05rem] tracking-[-0.025em]">{product.name}</h2>
          <div className="mt-3 flex items-center gap-2">
            {product.colorways.map((c) => (
              <span key={c.name} title={c.name} className="size-3.5 rounded-full border border-line" style={{ background: c.body }} />
            ))}
            <span className="label ml-1">{product.colorways.length} {product.colorways.length === 1 ? "colourway" : "colourways"}</span>
          </div>
        </div>
        <Price product={product} badge={false} />
      </div>
    </Link>
  );
}
