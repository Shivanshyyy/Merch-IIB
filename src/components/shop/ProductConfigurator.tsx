"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SizeChart } from "@/components/shop/SizeChart";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Stepper } from "@/components/ui/Stepper";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { site } from "@/config/site";
import { colorwayImage, fmtDate, inr } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { normalizeName } from "@/lib/schemas";
import type { Product } from "@/lib/types";
import { useBatchClosed } from "@/lib/useBatchClosed";
import { useCart } from "@/store/cart";

type BatchInfo = { name: string; closesAt: string; estDelivery: string } | null;

export function ProductConfigurator({ product, batch }: { product: Product; batch: BatchInfo }) {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  const { toast } = useToast();
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

  const editLine = editId ? lines.find((l) => l.id === editId && l.slug === product.slug) : undefined;
  const prefilled = useRef(false);
  useEffect(() => {
    if (!editLine || !hydrated || prefilled.current) return;
    prefilled.current = true;
    setCw(Math.max(0, product.colorways.findIndex((c) => c.name === editLine.colorway)));
    setSize(editLine.size);
    setName(editLine.name);
    setQty(editLine.qty);
  }, [editLine, hydrated, product.colorways]);

  const closed = useBatchClosed(batch?.closesAt) || !batch;
  const colorway = product.colorways[cw];

  const onName = (raw: string) => {
    const cleaned = raw.replace(/[^A-Za-z .'-]/g, "").replace(/^ +/, "").replace(/ {2,}/g, " ");
    setName((site.nameUppercase ? cleaned.toUpperCase() : cleaned).slice(0, site.nameMaxLength));
    setView("back");
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
      name: normalizeName(name),
      qty,
      unitPriceInr: product.price_inr,
    };
    if (editLine) {
      replace(editLine.id, payload);
      toast({ message: "Cart updated" });
      router.push("/cart");
      return;
    }
    add(payload);
    buzz(10);
    toast({ message: "Added to cart", action: { label: "View cart", href: "/cart" } });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const printed = normalizeName(name);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-0">
      {/* Image panel */}
      <div className="lg:sticky lg:top-[calc(var(--nav-h)+1px)] lg:self-start lg:border-r lg:border-line">
        <div className="relative aspect-square max-h-[78svh] w-full overflow-hidden bg-bg-2 [container-type:inline-size] lg:max-h-[calc(100svh-var(--nav-h)-1px)]">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_55%,rgba(255,59,31,0.32),transparent_72%)]" />
          <AnimatePresence initial={false}>
            <motion.div key={`${colorway.name}-${view}`} className="absolute inset-0" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <Image src={colorwayImage(product.slug, colorway.name, view)} alt={`${product.name} in ${colorway.name}, ${view} view`} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-contain p-4" />
            </motion.div>
          </AnimatePresence>

          {view === "back" && printed && (
            <p
              aria-hidden
              className="t-display pointer-events-none absolute left-1/2 top-[35.5%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
              style={{ color: colorway.stitch, fontSize: `min(4.6cqw, calc(30cqw / ${Math.max(printed.length * 0.9, 6)}))`, letterSpacing: "0.06em", textShadow: "0 1px 0 rgba(0,0,0,.35)" }}
            >
              {printed}
            </p>
          )}

          <div role="group" aria-label="View" className="absolute bottom-3 left-3 flex border border-line bg-bg/80 backdrop-blur-sm">
            {(["front", "back"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className="label flex min-h-11 items-center px-4 transition-colors aria-pressed:bg-fg aria-pressed:text-bg">
                {v}
              </button>
            ))}
          </div>
          {view === "back" && printed && <p className="label absolute bottom-3 right-3 hidden bg-bg/70 px-2 py-1 backdrop-blur-sm sm:block">Preview is illustrative</p>}
        </div>
      </div>

      {/* Controls */}
      <div className="flex min-w-0 flex-col gap-8 px-[var(--gutter)] pb-16 lg:px-10 lg:py-10 xl:px-14">
        <header>
          <p className="label">[ Shop / {product.type} ]</p>
          <h1 className="t-display mt-3 text-[clamp(2rem,4.6vw,3.6rem)]">{product.name}</h1>
          <div className="mt-5 flex items-baseline gap-4">
            <p className="mono text-3xl">{inr(product.price_inr)}</p>
            {batch && <p className="label">{batch.name} · preorder</p>}
          </div>
          <p className="mt-4 max-w-md text-muted">{product.description}</p>
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
                {name.length}/{site.nameMaxLength}
              </span>
            }
            value={name}
            onChange={(e) => onName(e.target.value)}
            onFocus={() => setView("back")}
            maxLength={site.nameMaxLength}
            placeholder="YOUR NAME"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            help={`Optional. Letters, spaces and . ' - only. ${site.nameUppercase ? "Printed in capitals." : ""}`}
          />
        )}

        <div className="flex items-center justify-between gap-4">
          <p className="label">Quantity</p>
          <Stepper value={qty} onChange={setQty} label="quantity" />
        </div>

        <div className="grid gap-5">
          <Button size="lg" block onClick={submit} disabled={closed}>
            {closed ? "Preorders closed" : editLine ? "Update cart" : added ? "Added ✓" : `Add to cart · ${inr(product.price_inr * qty)}`}
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
              <dd className="text-right">{site.pickup.location}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
