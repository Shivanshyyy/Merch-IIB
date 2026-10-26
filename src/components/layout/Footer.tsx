import Link from "next/link";
import { site, whatsappUrl, type Settings } from "@/config/site";

export function Footer({ settings: s }: { settings: Settings }) {
  return (
    <footer className="mt-auto overflow-hidden border-t border-line">
      <div className="shell grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="label mb-4">[ Need a hand? ]</p>
          <p className="t-display max-w-[18ch] text-[clamp(1.4rem,3vw,2.2rem)] leading-[1.05] tracking-[-0.03em]">
            Messed up something? Message {s.contactName} on{" "}
            <a href={whatsappUrl(s.whatsapp, "Hi, I need help with my merch order.")} className="text-accent underline decoration-1 underline-offset-[6px] hover:text-accent-2" rel="noopener">
              WhatsApp
            </a>
          </p>
          <p className="mt-4 max-w-md text-muted">{s.contactName} fixes spelling, sizes, payments and forgotten passwords by hand.</p>
        </div>

        <nav aria-label="Footer" className="grid content-start gap-1">
          <p className="label mb-3">[ Pages ]</p>
          {[
            ["/shop", "Shop"],
            ["/orders", "My orders"],
            ["/cart", "Cart"],
            ["/policies", "Refunds, pickup & privacy"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="flex min-h-11 items-center text-[0.95rem] transition-colors hover:text-accent-2">
              {label}
            </Link>
          ))}
        </nav>

        <div className="grid content-start gap-4">
          <p className="label">[ Pickup ]</p>
          <p className="mono text-[0.85rem] leading-relaxed">
            {s.pickupLocation}
            <br />
            {s.pickupRoom}
            <br />
            {s.pickupHours}
          </p>
          <p className="label normal-case leading-relaxed tracking-normal">
            3D model &ldquo;{site.modelCredit.title}&rdquo; by{" "}
            <a href={site.modelCredit.url} className="underline underline-offset-4 hover:text-fg" rel="noopener noreferrer" target="_blank">
              {site.modelCredit.author}
            </a>
            , licensed {site.modelCredit.license}.
          </p>
        </div>
      </div>

      <div aria-hidden className="select-none whitespace-nowrap text-center font-display font-extrabold uppercase leading-[0.8] tracking-[-0.06em] text-transparent" style={{ fontSize: "clamp(3rem, 15.5vw, 16rem)", WebkitTextStroke: "1px var(--line)" }}>
        {s.brand}
      </div>
      <div className="shell flex flex-wrap justify-between gap-2 py-6">
        <p className="label">© {s.brand}</p>
        <p className="label">Preorders only · Made to order</p>
      </div>
    </footer>
  );
}
