import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="page">
      <div className="shell">
        <p className="label">[ 02 ] — Your cart</p>
        <Reveal as="h1" trigger="load" className="t-display t-h1 mt-4">
          Cart
        </Reveal>
        <CartView />
      </div>
    </div>
  );
}
