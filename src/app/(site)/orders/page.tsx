import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderCard } from "@/components/track/OrderCard";
import { Button } from "@/components/ui/Button";
import { requireProfile } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "My orders" };

export default function OrdersPage() {
  return (
    <div className="page">
      <div className="shell">
        <p className="label">[ 04 ] — Your orders</p>
        <h1 className="t-display t-h1 mt-4">My orders</h1>
        <Suspense fallback={<div className="skeleton mt-12 h-72" aria-hidden />}>
          <Orders />
        </Suspense>
      </div>
    </div>
  );
}

async function Orders() {
  const { user } = await requireProfile("/orders");
  const [orders, settings] = await Promise.all([db().listOrdersByUser(user.id), getSettings()]);

  if (orders.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center gap-6 border border-dashed border-line px-6 py-20 text-center">
        <svg width="96" height="64" viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted" aria-hidden>
          <circle cx="14" cy="32" r="6" />
          <circle cx="48" cy="32" r="6" strokeDasharray="2 3" />
          <circle cx="82" cy="32" r="6" strokeDasharray="2 3" />
          <path d="M20 32h22M54 32h22" strokeDasharray="3 4" />
        </svg>
        <div>
          <p className="t-display text-2xl">No orders yet</p>
          <p className="mx-auto mt-3 max-w-sm text-muted">When you place an order it shows up here, with its status from payment to pickup.</p>
        </div>
        <Button href="/shop" size="lg">
          Browse the drop
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-12 grid gap-8">
      <p className="label">
        [ {orders.length} {orders.length === 1 ? "order" : "orders"} ] — newest first
      </p>
      {orders.map((o) => (
        <OrderCard key={o.code} order={o} contactName={settings.contactName} />
      ))}
    </div>
  );
}
