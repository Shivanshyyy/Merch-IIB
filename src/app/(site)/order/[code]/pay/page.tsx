import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OpenUpiButton } from "@/components/order/OpenUpiButton";
import { UtrForm } from "@/components/order/UtrForm";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatPhone, whatsappUrl } from "@/config/site";
import { requireProfile } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { orderCodeSchema } from "@/lib/schemas";
import { getSettingsFresh } from "@/lib/settings";
import { isPlaceholderUpi } from "@/lib/settings-schema";
import { upiLink, upiQrDataUrl } from "@/lib/upi";

export const metadata: Metadata = { title: "Pay for your order", robots: { index: false } };

type Props = { params: Promise<{ code: string }> };

export default function PayPage({ params }: Props) {
  return (
    <div className="page ember">
      <div className="shell">
        <Suspense fallback={<div className="skeleton h-[480px]" aria-hidden />}>
          <Pay params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Pay({ params }: Props) {
  const parsed = orderCodeSchema.safeParse(decodeURIComponent((await params).code));
  if (!parsed.success) notFound();

  // Owner only: the code alone is no longer enough to see an order.
  const { user } = await requireProfile(`/order/${parsed.data}/pay`);
  const order = await db().getOrderByCode(parsed.data);
  if (!order || order.user_id !== user.id) notFound();

  // Fresh read: a customer must never pay to a UPI ID that was changed a minute ago.
  const s = await getSettingsFresh();
  const paymentsReady = !(process.env.VERCEL_ENV === "production" && isPlaceholderUpi(s.upiId));
  const link = upiLink(s, order.total_inr, order.code);
  const qr = paymentsReady ? await upiQrDataUrl(link) : "";
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);
  const wa = (text: string) => whatsappUrl(s.whatsapp, text);

  return (
    <>
      <p className="label">[ Step 1 of 3 ] — Pay</p>

      {order.payment_status === "verified" && (
        <p role="status" className="mt-6 bg-accent-2 px-5 py-4 font-mono text-[0.8rem] uppercase tracking-[0.1em] text-bg">
          Payment verified. You&apos;re all set.{" "}
          <Link href="/orders" className="underline underline-offset-4">
            Track your order →
          </Link>
        </p>
      )}
      {order.payment_status === "rejected" && (
        <p role="alert" className="mt-6 border border-accent px-5 py-4 text-[#ff7a63]">
          We couldn&apos;t match your payment. Message {s.contactName} on WhatsApp with your screenshot and order code and we&apos;ll sort it out.
        </p>
      )}

      <header className="mt-6 grid gap-6 border-b border-line pb-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="label">Your order code</p>
          <h1 className="mono mt-3 text-[clamp(2.6rem,12vw,8rem)] font-medium leading-none tracking-[-0.04em]">{order.code}</h1>
        </div>
        <div className="md:text-right">
          <p className="label">
            Amount to pay · {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
          <p className="mono mt-3 text-[clamp(2.2rem,7vw,4.5rem)] leading-none">{inr(order.total_inr)}</p>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-20">
        {/* Pay */}
        <section aria-labelledby="pay-h" className="grid content-start gap-5">
          <h2 id="pay-h" className="sr-only">
            Pay with UPI
          </h2>
          {paymentsReady ? (
            <>
              <div className="bg-fg p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, nothing to optimise */}
                <img src={qr} alt={`UPI QR code for ${inr(order.total_inr)}, order ${order.code}`} width={420} height={420} className="aspect-square w-full" />
              </div>
              <p className="label text-center normal-case tracking-normal">The amount and order code are filled in for you. Don&apos;t edit them.</p>

              <OpenUpiButton link={link} />

              <div className="border border-line bg-bg-2 p-4">
                <p className="label">UPI ID</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="mono break-all text-[1.05rem]">{s.upiId}</p>
                  <CopyButton text={s.upiId} label="Copy UPI ID" toastMessage="UPI ID copied" />
                </div>
                <p className="label mt-3 normal-case tracking-normal">
                  Paying to {s.payeeName}. Add {order.code} in the note.
                </p>
              </div>
            </>
          ) : (
            <div role="alert" className="border border-accent-2 p-6">
              <p className="t-display text-xl">Payments are being set up</p>
              <p className="mt-3 text-muted">Your order {order.code} is saved. Message {s.contactName} on WhatsApp and they&apos;ll send you the payment details.</p>
              <div className="mt-5">
                <Button href={wa(`Hi, I placed order ${order.code} for ${inr(order.total_inr)}. How do I pay?`)} target="_blank" rel="noopener">
                  WhatsApp {s.contactName}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Steps */}
        <div className="grid content-start gap-10">
          <ol className="grid gap-px bg-line">
            <li className="grid gap-3 bg-bg p-6">
              <p className="label text-accent-2">01 — Pay</p>
              <p>
                Pay <span className="mono">{inr(order.total_inr)}</span> by scanning the QR, tapping Open UPI app, or sending to the UPI ID above with <span className="mono">{order.code}</span> in the note.
              </p>
            </li>
            <li className="grid gap-4 bg-bg p-6">
              <p className="label text-accent-2">02 — Send the screenshot on WhatsApp</p>
              <p>
                Send a screenshot of the payment to {s.contactName} ({formatPhone(s.phone)}) so it can be verified.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button href={wa(`Hi, I paid ${inr(order.total_inr)} for order ${order.code}. Screenshot attached.`)} variant="quiet" target="_blank" rel="noopener">
                  WhatsApp {s.contactName}
                </Button>
                <Button href={`tel:+${s.phone}`} variant="ghost">
                  Call {s.contactName}
                </Button>
              </div>
            </li>
            <li className="grid gap-3 bg-bg p-6">
              <p className="label text-accent-2">03 — Check your status</p>
              <p>
                We verify payments by hand. Follow your order in My orders; its status updates as soon as {s.contactName} verifies it.
              </p>
              <div>
                <Button href="/orders" variant="ghost">
                  My orders
                </Button>
              </div>
            </li>
          </ol>

          {order.payment_status === "pending" && (
            <section aria-label="Payment reference" className="border border-line p-6">
              <UtrForm code={order.code} />
            </section>
          )}

          <section aria-labelledby="policy-h" className="border border-line bg-bg-2 p-6">
            <h2 id="policy-h" className="label text-fg">
              [ Refund &amp; pickup policy ]
            </h2>
            <ul className="mt-5 grid gap-3 text-[0.95rem] leading-relaxed">
              <li>
                <strong>Refund eligible within {s.refundWindowDays} days of pickup</strong> for defective, misprinted or wrong items.
              </li>
              <li>Personalised items may not be eligible for change-of-mind returns, so double-check your name spelling and size.</li>
              <li>
                Collection and returns happen at <strong>{s.pickupLocation}</strong>, {s.pickupRoom}, {s.pickupHours}.
              </li>
            </ul>
            <Link href="/policies" className="label mt-5 inline-block underline underline-offset-4 hover:text-fg">
              Read the full policy →
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
