import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { getOpenBatch, getProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <div className="page">
      <div className="shell">
        <p className="label">[ 03 ] — Checkout</p>
        <h1 className="t-display t-h1 mt-4">Checkout</h1>
        <Suspense fallback={<div className="skeleton mt-12 h-96" aria-hidden />}>
          <Checkout />
        </Suspense>
      </div>
    </div>
  );
}

async function Checkout() {
  const [products, batch] = await Promise.all([getProducts(), getOpenBatch()]);
  const prices = Object.fromEntries(products.map((p) => [p.slug, p.price_inr]));
  return <CheckoutForm prices={prices} batch={batch ? { name: batch.name, closesAt: batch.closes_at } : null} />;
}
