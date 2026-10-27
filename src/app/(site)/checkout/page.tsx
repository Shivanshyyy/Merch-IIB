import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { whatsappUrl } from "@/config/site";
import { getSessionUser } from "@/lib/auth/session";
import { getOpenBatch, getProducts } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="page">
      <div className="shell">
        <p className="label">[ 03 ] — Checkout</p>
        <Reveal as="h1" trigger="load" className="t-display t-h1 mt-4">
          Checkout
        </Reveal>
        <Suspense fallback={<div className="skeleton mt-12 h-96 min-h-[calc(100svh-16rem)]" aria-hidden />}>
          <Checkout />
        </Suspense>
      </div>
    </div>
  );
}

async function Checkout() {
  const [user, products, batch, settings] = await Promise.all([getSessionUser(), getProducts(), getOpenBatch(), getSettings()]);

  if (!user) {
    return (
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-24">
        <div>
          <p className="t-display text-[clamp(1.4rem,3vw,2.2rem)] leading-[1.05]">Log in to place your order</p>
          <p className="mt-6 max-w-md text-muted">Your cart is saved on this device and will be waiting when you&apos;re back. Log in or create an account, and you&apos;ll land right here.</p>
        </div>
        <FreshOnVisit>
          <AuthPanel next="/checkout" forgotHref={whatsappUrl(settings.whatsapp, "Hi, I forgot my password for my merch account. Can you set a new one?")} contactName={settings.contactName} />
        </FreshOnVisit>
      </div>
    );
  }

  const profile = await db().getProfile(user.id);
  if (!profile) redirect("/account?next=%2Fcheckout");
  const last = (await db().listOrdersByUser(user.id))[0];

  return (
    <FreshOnVisit>
      <CheckoutForm
      prices={Object.fromEntries(products.map((p) => [p.slug, p.price_inr]))}
      batch={batch ? { name: batch.name, closesAt: batch.closes_at } : null}
      email={user.email}
      defaults={{ fullName: profile.full_name, phone: profile.phone, hostel: last?.hostel ?? "", room: last?.room ?? "" }}
      />
    </FreshOnVisit>
  );
}
