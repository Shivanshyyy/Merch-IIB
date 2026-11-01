"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SizeChart } from "@/components/shop/SizeChart";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Stepper } from "@/components/ui/Stepper";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/components/SettingsProvider";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { PhotoGallery } from "@/components/shop/PhotoGallery";
import { BackName } from "@/components/shop/BackName";
import { nameSpot } from "@/lib/name-spots";
import { unitPrice } from "@/lib/offers";
import { Price } from "@/components/shop/Price";
import { fmtDate, inr } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { normalizeName } from "@/lib/schemas";
import type { PromoView } from "@/lib/promo";
import type { Product } from "@/lib/types";
import { FreebiesBanner } from "@/components/promo/FreebiesBanner";
import { useBatchClosed } from "@/lib/useBatchClosed";
import { useCart } from "@/store/cart";
import { flyToCart } from "@/store/fly";

type BatchInfo = { name: string; closesAt: string; estDelivery: string } | null;

export function ProductConfigurator({ product, batch, promo }: { product: Product; batch: BatchInfo; promo: PromoView | null }) {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  const { toast } = useToast();
  const settings = useSettings();
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const add = useCart((s) => s.add);
  const replace = useCart((s) => s.replace);

  const [cw, setCw] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [view, setView] = useState<"front" | "back">("front");
  const [sizeError, setSizeError] = useState<string>();
  const [added, setAdded] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  const editLine = editId ? lines.find((l) => l.id === editId && l.slug === product.slug) : undefined;
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!editLine || !hydrated || prefilledFor.current === editLine.id) return;
    prefilledFor.current = editLine.id; // per line, so editing a second line later prefills too
    setCw(Math.max(0, product.colorways.findIndex((c) => c.name === editLine.colorway)));
    setSize(editLine.size);
    setName(editLine.name);
    setQty(editLine.qty);
  }, [editLine, hydrated, product.colorways]);

  // Pre-select the size saved on the account, unless the shopper already picked one (or is editing a cart line).
  const sizeTouched = useRef(false);
  useEffect(() => {
    if (editId) return;
    let live = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { defaultSize?: string | null } | null) => {
        if (live && me?.defaultSize && !sizeTouched.current && product.sizes.includes(me.defaultSize)) setSize(me.defaultSize);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [editId, product.sizes]);

  const closed = useBatchClosed(batch?.closesAt) || !batch;
  const colorway = product.colorways[cw];
  const hasPhotos = product.photos.length > 0;

  const onName = (raw: string) => {
    const cleaned = raw.replace(/[^A-Za-z .'-]/g, "").replace(/^ +/, "").replace(/ {2,}/g, " ");
    setName((settings.nameUppercase ? cleaned.toUpperCase() : cleaned).slice(0, settings.nameMaxLength));
    if (!hasPhotos) setView("back");
  };

  const submit = () => {
    if (!size) {
      setSizeError("Pick a size to continue");
      return;
    }
    const payload = {
      slug: product.slug,
      productName: product.name,
      colorway: colorway.name,
      colorwayBody: colorway.body,
      size,
      name: normalizeName(name, settings),
      qty,
      unitPriceInr: unitPrice(product, normalizeName(name, settings)),
      productType: product.type,
    };
    if (editLine) {
      replace(editLine.id, payload);
      toast({ message: "Cart updated" });
      router.push("/cart");
      return;
    }
    add(payload);
    buzz(10);
    // The picture on the page lifts off and lands in the cart button.
    flyToCart(stage.current?.getBoundingClientRect() ?? null, { src: stage.current?.querySelector("img")?.currentSrc ?? "", body: colorway.body, qty });
    toast({ message: "Added to cart", action: { label: "View cart", href: "/cart" } });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const printed = normalizeName(name, settings);
  const spot = nameSpot(product.slug);
  const unit = unitPrice(product, printed);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-0">
      {/* Image panel */}
      <div className="lg:sticky lg:top-[calc(var(--nav-h)+1px)] lg:self-start lg:border-r lg:border-line">
        <div ref={stage} className="relative aspect-square max-h-[78svh] w-full overflow-hidden bg-bg-2 [container-type:inline-size] lg:max-h-[calc(100svh-var(--nav-h)-1px)]">
          {hasPhotos ? (
            <PhotoGallery photos={product.photos} alt={product.name} />
          ) : (
            <>
              <AnimatePresence initial={false}>
                <motion.div key={`${colorway.name}-${view}`} className="absolute inset-0" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                  <ColorwayImage slug={product.slug} colorway={colorway.name} body={colorway.body} stitch={colorway.stitch} view={view} alt={`${product.name} in ${colorway.name}, ${view} view`} priority sizes="(min-width: 1024px) 55vw, 100vw" className={view === "front" ? "object-cover object-top" : "object-cover"} />
                </motion.div>
              </AnimatePresence>

              {view === "back" && product.personalizable && spot && <BackName name={printed} spot={spot} body={colorway.body} ink={colorway.stitch} />}

              <div role="group" aria-label="View" className="absolute left-3 top-3 flex border border-line bg-bg/80 backdrop-blur-sm">
                {(["front", "back"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className="label flex min-h-11 items-center px-4 transition-colors aria-pressed:bg-fg aria-pressed:text-bg">
                    {v}
                  </button>
                ))}
              </div>
              {view === "back" && printed && <p className="label absolute bottom-3 right-3 hidden bg-bg/70 px-2 py-1 backdrop-blur-sm sm:block">Preview is illustrative</p>}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex min-w-0 flex-col gap-8 px-[var(--gutter)] pb-16 lg:px-10 lg:py-10 xl:px-14">
        <header>
          <p className="label">[ Shop / {product.type} ]</p>
          <Reveal as="h1" trigger="load" className="t-display mt-3 text-[clamp(2rem,4.6vw,3.6rem)]">
            {product.name}
          </Reveal>
          <div className="mt-5 flex items-baseline gap-4">
            <Price product={product} className="text-3xl" />
            {batch && <p className="label">{batch.name} · preorder</p>}
          </div>
          <p className="mt-4 max-w-md text-muted">{product.description}</p>
          {promo && (
            <div className="mt-5">
              <FreebiesBanner promo={promo} compact />
            </div>
          )}
        </header>

        <ChipGroup
          legend={<>Colour — <span className="text-fg">{colorway.name}</span></>}
          options={product.colorways.map((c, i) => ({ value: String(i), label: c.name, swatch: c.body }))}
          value={String(cw)}
          onChange={(v) => {
            setCw(Number(v));
          }}
        />

        <ChipGroup
          legend="Size"
          hint={<SizeChart sizes={product.sizes} />}
          options={product.sizes.map((s) => ({ value: s, label: s }))}
          value={size}
          onChange={(v) => {
            sizeTouched.current = true;
            setSize(v);
            setSizeError(undefined);
          }}
          error={sizeError}
        />

        {product.personalizable && (
          <TextField
            label="Name on the back"
            aside={
              <span className="mono" aria-live="polite">
                {name.length}/{settings.nameMaxLength}
              </span>
            }
            value={name}
            onChange={(e) => onName(e.target.value)}
            onFocus={() => !hasPhotos && setView("back")}
            maxLength={settings.nameMaxLength}
            placeholder="YOUR NAME"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            help={`Optional${product.name_fee_inr ? `, +${inr(product.name_fee_inr)} for the name print` : ""}. Letters, spaces and . ' - only.${settings.nameUppercase ? " Printed in capitals." : ""}`}
          />
        )}

        <div className="flex items-center justify-between gap-4">
          <p className="label">Quantity</p>
          <Stepper value={qty} onChange={setQty} label="quantity" />
        </div>

        <div className="grid gap-5">
          <Button size="lg" block onClick={submit} disabled={closed}>
            {closed ? "Preorders closed" : editLine ? "Update cart" : added ? "Added ✓" : `Add to cart · ${inr(unit * qty)}`}
          </Button>
          <p className="label normal-case leading-relaxed tracking-normal">Made to order. Double-check name spelling: we print exactly what you type.</p>
        </div>

        {batch && (
          <dl className="mono grid gap-px border border-line bg-line text-[0.8rem]">
            <div className="flex justify-between gap-4 bg-bg p-4">
              <dt className="text-muted">Preorder closes</dt>
              <dd className="text-right">{fmtDate(batch.closesAt)}</dd>
            </div>
            <div className="flex justify-between gap-4 bg-bg p-4">
              <dt className="text-muted">Estimated delivery</dt>
              <dd className="text-right">{batch.estDelivery}</dd>
            </div>
            <div className="flex justify-between gap-4 bg-bg p-4">
              <dt className="text-muted">Pickup</dt>
              <dd className="text-right">{settings.pickupLocation}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
