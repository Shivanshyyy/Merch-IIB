import type { Order, OrderStatus, PaymentStatus, RefundStatus } from "@/lib/types";

export type Tone = "good" | "warn" | "serious" | "critical" | "muted" | "none";
type IconKind = "check" | "clock" | "alert" | "cross" | "dash" | "dot" | "half";

const PAYMENT: Record<PaymentStatus, { label: string; tone: Tone; icon: IconKind }> = {
  pending: { label: "Payment pending", tone: "warn", icon: "clock" },
  verified: { label: "Payment verified", tone: "good", icon: "check" },
  rejected: { label: "Payment rejected", tone: "critical", icon: "cross" },
};
const ORDER: Record<OrderStatus, { label: string; tone: Tone; icon: IconKind }> = {
  placed: { label: "Placed", tone: "none", icon: "dot" },
  in_production: { label: "In production", tone: "none", icon: "half" },
  ready: { label: "Ready for pickup", tone: "good", icon: "check" },
  collected: { label: "Collected", tone: "muted", icon: "check" },
  cancelled: { label: "Cancelled", tone: "muted", icon: "dash" },
};
const REFUND: Record<RefundStatus, { label: string; tone: Tone; icon: IconKind }> = {
  none: { label: "No refund", tone: "none", icon: "dot" },
  requested: { label: "Refund requested", tone: "serious", icon: "alert" },
  approved: { label: "Refund approved", tone: "serious", icon: "alert" },
  refunded: { label: "Refunded", tone: "muted", icon: "check" },
};

// One tone per row, by what needs doing first.
export function rowTone(o: Order): Tone {
  if (o.order_status === "cancelled" || o.order_status === "collected" || o.refund_status === "refunded") return "muted";
  if (o.payment_status === "rejected") return "critical";
  if (o.refund_status === "requested" || o.refund_status === "approved") return "serious";
  if (o.payment_status === "pending") return "warn";
  if (o.order_status === "ready" || o.payment_status === "verified") return "good";
  return "none";
}

const Icon = ({ kind }: { kind: IconKind }) => {
  const common = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (kind) {
    case "check":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.2 8.2 2 2 3.6-4" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 4.6V8l2.3 1.4" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M8 2.2 14.2 13H1.8L8 2.2Z" />
          <path d="M8 6.5v3M8 11.3v.1" />
        </svg>
      );
    case "cross":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.8 5.8 4.4 4.4M10.2 5.8l-4.4 4.4" />
        </svg>
      );
    case "dash":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M5.4 8h5.2" />
        </svg>
      );
    case "half":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4Z" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" />
        </svg>
      );
  }
};

function Chip({ label, tone, icon }: { label: string; tone: Tone; icon: IconKind }) {
  // The mark carries the colour; the label stays in the normal text colour.
  return (
    <span className={`tone-${tone} inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8rem]`}>
      <span className={tone === "none" ? "text-muted" : "text-[var(--tone)]"}>
        <Icon kind={icon} />
      </span>
      {label}
    </span>
  );
}

export const PaymentChip = ({ status }: { status: PaymentStatus }) => <Chip {...PAYMENT[status]} />;
export const OrderChip = ({ status }: { status: OrderStatus }) => <Chip {...ORDER[status]} />;
export const RefundChip = ({ status }: { status: RefundStatus }) => <Chip {...REFUND[status]} />;
export const FreebieChip = () => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8rem]">
    <span aria-hidden className="text-accent-2">✦</span>
    Freebie
  </span>
);
