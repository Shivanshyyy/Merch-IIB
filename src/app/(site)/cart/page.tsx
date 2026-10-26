import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="page">
      <div className="shell">
        <p className="label">[ 02 ] — Your cart</p>
        <h1 className="t-display t-h1 mt-4">Cart</h1>
        <CartView />
      </div>
    </div>
  );
}
