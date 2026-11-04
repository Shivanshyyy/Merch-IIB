import { isLive } from "@/lib/admin/stats";
import type { Order, Payout } from "@/lib/types";

// Where a sale stands: counted once payment is verified, void if cancelled or refunded.
export type SaleState = "counted" | "pending" | "void";

// What a designer may see about a sale: never the buyer, the order code or what the buyer paid.
export type DesignerSale = {
  date: string;
  productId: string;
  productName: string;
  colorway: string;
  size: string;
  qty: number;
  commissionInr: number;
  state: SaleState;
};

export type ProductSales = { productId: string; productName: string; units: number; earnedInr: number; pendingUnits: number };

export type DesignerSummary = {
  unitsSold: number;
  unitsPending: number;
  earnedInr: number;
  paidInr: number;
  /** Earned minus paid out; can dip below zero if a refund lands after a payout. */
  balanceInr: number;
  byProduct: ProductSales[];
  sales: DesignerSale[];
};

export function saleState(o: Order): SaleState {
  if (isLive(o)) return "counted";
  if (o.payment_status === "pending" && o.order_status !== "cancelled") return "pending";
  return "void";
}

export function summarizeDesigner(orders: Order[], designerId: string, payouts: Payout[]): DesignerSummary {
  const sales: DesignerSale[] = [];
  const products = new Map<string, ProductSales>();
  let unitsSold = 0;
  let unitsPending = 0;
  let earnedInr = 0;

  for (const o of orders) {
    const state = saleState(o);
    for (const i of o.items) {
      if (i.designer?.id !== designerId) continue;
      const commissionInr = i.designer.unitCommissionInr * i.qty;
      sales.push({ date: o.created_at, productId: i.designer.productId, productName: i.productName, colorway: i.colorway, size: i.size, qty: i.qty, commissionInr, state });
      if (state === "void") continue;

      const row = products.get(i.designer.productId) ?? { productId: i.designer.productId, productName: i.productName, units: 0, earnedInr: 0, pendingUnits: 0 };
      if (state === "counted") {
        row.units += i.qty;
        row.earnedInr += commissionInr;
        unitsSold += i.qty;
        earnedInr += commissionInr;
      } else {
        row.pendingUnits += i.qty;
        unitsPending += i.qty;
      }
      products.set(i.designer.productId, row);
    }
  }

  const paidInr = payouts.filter((p) => p.designer_id === designerId).reduce((n, p) => n + p.amount_inr, 0);
  return {
    unitsSold,
    unitsPending,
    earnedInr,
    paidInr,
    balanceInr: earnedInr - paidInr,
    byProduct: [...products.values()].sort((a, b) => b.units - a.units || b.pendingUnits - a.pendingUnits || a.productName.localeCompare(b.productName)),
    sales: sales.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
