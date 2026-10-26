import type { Metadata } from "next";
import { site, whatsappLink } from "@/config/site";

export const metadata: Metadata = { title: "Refunds, pickup & privacy" };

const SECTIONS = [
  { id: "refunds", label: "Refunds & returns" },
  { id: "pickup", label: "Pickup" },
  { id: "made-to-order", label: "Made to order" },
  { id: "privacy", label: "Privacy" },
  { id: "credits", label: "Credits" },
] as const;

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line py-10 first:border-t-0 first:pt-0">
      <p className="label">[ {n} ]</p>
      <h2 id={`${id}-h`} className="t-display t-h2 mt-3">
        {title}
      </h2>
      <div className="mt-6 grid max-w-2xl gap-4 leading-relaxed text-[color-mix(in_srgb,var(--fg)_88%,transparent)]">{children}</div>
    </section>
  );
}

export default function PoliciesPage() {
  return (
    <div className="page">
      <div className="shell">
        <p className="label">[ 05 ] — The small print</p>
        <h1 className="t-display t-h1 mt-4">Policies</h1>

        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-[calc(var(--nav-h)+24px)] grid gap-1">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="label flex min-h-11 items-center gap-3 hover:text-fg">
                    <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <Section id="refunds" n="01" title="Refunds & returns">
              <p>
                You&apos;re eligible for a refund <strong>within {site.refundWindowDays} days of pickup</strong> if your item is <strong>defective, misprinted or the wrong item</strong>. Bring it to {site.pickup.location} (details below) and we&apos;ll sort it out, with a replacement or a refund.
              </p>
              <p>
                Because every hoodie is made to order with a name on it, <strong>personalised items may not be eligible for change-of-mind returns</strong>. Please check your name spelling and size before you pay.
              </p>
              <p>
                If a refund is approved, it goes back by UPI to the account you paid from. You can follow its status on the{" "}
                <a href="/track" className="underline underline-offset-4 hover:text-accent-2">
                  track page
                </a>
                .
              </p>
            </Section>

            <Section id="pickup" n="02" title="Pickup">
              <p>
                Finished hoodies are collected at <strong>{site.pickup.location}</strong>, Room {site.pickup.room}, during {site.pickup.hours}. Returns and exchanges happen at the same place.
              </p>
              <p>We&apos;ll message you when your order is ready. Bring your order code (it looks like {site.orderCodePrefix}-7K4Q) and a screenshot of your payment if you have one.</p>
            </Section>

            <Section id="made-to-order" n="03" title="Made to order">
              <p>
                We don&apos;t keep stock. Orders are collected in batches, sent to our vendor together and printed to your spelling. That&apos;s why there&apos;s a cutoff date for each batch and an estimated delivery window on the product page.
              </p>
              <p>Your order is held as &ldquo;payment pending&rdquo; until {site.contact.name} verifies your UPI payment by hand. Only paid, verified orders go into a batch.</p>
              <p>
                Spotted a typo? Message {site.contact.name} on{" "}
                <a href={whatsappLink("Hi, I need to fix something on my order.")} className="underline underline-offset-4 hover:text-accent-2" rel="noopener">
                  WhatsApp
                </a>{" "}
                before the batch closes and it can be corrected.
              </p>
            </Section>

            <Section id="privacy" n="04" title="Privacy">
              <p>
                <strong>What we store:</strong> your name, email, phone number, hostel and room, what you ordered, your payment reference (UTR) if you share it, and the status of your order.
              </p>
              <p>
                <strong>Why:</strong> to take your order, match your payment, tell you when it&apos;s ready, and fix problems. Your email is how you look up your orders, since there&apos;s no login.
              </p>
              <p>
                <strong>Who sees it:</strong> the vendor receives only your <strong>name, size and personalisation</strong> (what&apos;s printed), plus colour and quantity. Never your phone, email or payment details. We don&apos;t sell or share your data, and we don&apos;t run ad trackers.
              </p>
              <p>To have your data removed after your order is complete, message {site.contact.name}.</p>
            </Section>

            <Section id="credits" n="05" title="Credits">
              <p>
                The 3D hoodie model, &ldquo;{site.modelCredit.title}&rdquo;, is by{" "}
                <a href={site.modelCredit.url} className="underline underline-offset-4 hover:text-accent-2" target="_blank" rel="noopener noreferrer">
                  {site.modelCredit.author}
                </a>{" "}
                on Sketchfab, licensed under {site.modelCredit.license}. It has been optimised for the web and recoloured.
              </p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
