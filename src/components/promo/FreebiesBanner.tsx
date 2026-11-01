import type { PromoView } from "@/lib/promo";

function ItemIcon({ item }: { item: string }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (/key/i.test(item))
    return (
      <svg {...common}>
        <circle cx="8" cy="6" r="3.2" />
        <path d="M9.6 8.8 11 11.4" />
        <circle cx="14" cy="16" r="5" />
        <circle cx="14" cy="16" r="2" />
      </svg>
    );
  if (/sticker/i.test(item))
    return (
      <svg {...common}>
        <path d="M5 4h14v9l-6 7H5z" />
        <path d="M19 13h-6v7" />
        <path d="m9 10 1.2-2.5L11.5 10l2.5.3-1.8 1.7.5 2.5-2.2-1.2-2.2 1.2.4-2.5L7 10.3z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="4" y="9" width="16" height="11" />
      <path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-5-1 .6 1.6 5 1 5 1Zm0 0c1.5-4 6-4 5-1-.6 1.6-5 1-5 1Z" />
    </svg>
  );
}

// The launch offer: what you get, and how many of the first N spots are left. Spots are claimed when payment is verified.
export function FreebiesBanner({ promo, compact = false }: { promo: PromoView; compact?: boolean }) {
  const gone = promo.left === 0;
  const pct = Math.round(((promo.limit - promo.left) / promo.limit) * 100);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-accent-2/40 bg-accent-2/[0.06] px-4 py-3 text-[0.9rem]" role="note">
        <span aria-hidden className="text-accent-2">✦</span>
        <span className="font-semibold">{gone ? "Freebies all claimed" : promo.title}</span>
        {!gone && <span className="text-muted">{promo.items.join(" + ")}</span>}
        {!gone && <span className="mono ml-auto text-[0.8rem] text-accent-2">{promo.left} left</span>}
      </div>
    );
  }

  return (
    <section aria-labelledby="freebies-h" className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_80%_at_85%_50%,rgba(255,181,71,0.13),transparent_70%)]" />
      <div className="shell relative grid gap-8 py-12 md:grid-cols-[1.3fr_1fr] md:items-end md:py-16">
        <div>
          <p className="label text-accent-2">[ Launch offer ] — {gone ? "Claimed" : "While spots last"}</p>
          <h2 id="freebies-h" className="t-display mt-4 text-balance text-[clamp(2rem,6.5vw,4.4rem)]">
            {gone ? "All freebies claimed" : promo.title}
          </h2>
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {promo.items.map((item) => (
              <li key={item} className={`flex items-center gap-2.5 border border-line bg-bg-2/80 px-3.5 py-2.5 text-[0.95rem] ${gone ? "opacity-50" : ""}`}>
                <span className="text-accent-2">
                  <ItemIcon item={item} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          {promo.note && <p className="mt-4 max-w-md text-[0.95rem] text-muted">{promo.note}</p>}
        </div>

        <div className="md:justify-self-end md:text-right">
          <p className="mono text-[clamp(3.2rem,9vw,5.5rem)] leading-none tracking-tight text-accent-2">
            {String(promo.left).padStart(3, "0")}
            <span className="text-[0.35em] text-muted">/{promo.limit}</span>
          </p>
          <p className="label mt-2">{gone ? "No spots left" : "Spots left · claimed when your payment is verified"}</p>
          <div className="mt-4 h-1 w-full bg-line md:w-72" role="progressbar" aria-label="Freebies claimed" aria-valuemin={0} aria-valuemax={promo.limit} aria-valuenow={promo.limit - promo.left}>
            <div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
