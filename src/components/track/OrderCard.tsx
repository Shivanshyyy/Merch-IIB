import { site } from "@/config/site";
import { fmtDate, inr } from "@/lib/format";
import type { TrackedOrder } from "@/lib/form-state";

const STEPS = ["Placed", "Payment verified", "In production", "Ready for pickup", "Collected"] as const;

function reached(o: TrackedOrder): boolean[] {
  const s = o.order_status;
  return [true, o.payment_status === "verified", ["in_production", "ready", "collected"].includes(s), ["ready", "collected"].includes(s), s === "collected"];
}

const REFUND_COPY = { requested: "Refund requested", approved: "Refund approved", refunded: "Refund completed" } as const;

export function OrderCard({ order }: { order: TrackedOrder }) {
  const done = reached(order);
  const current = done.lastIndexOf(true);
  const cancelled = order.order_status === "cancelled";
  const rejected = order.payment_status === "rejected";

  return (
    <article className="border border-line">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-bg-2 p-5 sm:p-6">
        <div>
          <p className="label">Order code</p>
          <h3 className="mono mt-2 text-3xl tracking-[-0.03em]">{order.code}</h3>
        </div>
        <div className="text-right">
          <p className="label">{fmtDate(order.created_at)}</p>
          <p className="mono mt-2 text-2xl">{inr(order.total_inr)}</p>
        </div>
      </header>

      <div className="grid gap-8 p-5 sm:p-6 md:grid-cols-2">
        <ul className="grid content-start gap-3">
          {order.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-4 border-b border-line pb-3 last:border-0">
              <div>
                <p className="text-[0.95rem] font-medium">{i.productName}</p>
                <p className="label mt-1">
                  {i.colorway} · {i.size} · ×{i.qty}
                </p>
                {i.name && <p className="mono mt-1 text-[0.78rem] text-accent-2">{i.name}</p>}
              </div>
              <p className="mono text-[0.9rem]">{inr(i.unitPriceInr * i.qty)}</p>
            </li>
          ))}
        </ul>

        <div>
          {cancelled && <p className="mb-5 border border-accent p-3 text-[#ff7a63]">This order was cancelled.</p>}
          {rejected && (
            <p className="mb-5 border border-accent p-3 text-[#ff7a63]">
              We couldn&apos;t match your payment. Message {site.contact.name} on WhatsApp with your screenshot.
            </p>
          )}
          <ol aria-label="Order progress" className="relative grid gap-5">
            <span aria-hidden className="absolute bottom-2 left-[0.6rem] top-2 w-px bg-line" />
            {STEPS.map((label, i) => {
              const isDone = done[i];
              const isNow = i === current && !cancelled;
              return (
                <li key={label} aria-current={isNow ? "step" : undefined} className="relative flex items-center gap-4 pl-0">
                  <span
                    aria-hidden
                    className={`relative z-10 grid size-[1.3rem] place-items-center rounded-full border ${isDone ? "border-accent bg-accent text-bg" : "border-line bg-bg"} ${isNow ? "shadow-[0_0_0_5px_rgba(255,59,31,0.22)]" : ""}`}
                  >
                    {isDone && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12.5 9.500 18 20 6" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-[0.95rem] ${isDone ? "text-fg" : "text-muted"}`}>
                    {label}
                    {i === 1 && order.verified_at && <span className="label ml-2">{fmtDate(order.verified_at)}</span>}
                    <span className="sr-only">{isDone ? " (done)" : " (not yet)"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {order.refund_status !== "none" && (
            <p className="label mt-6 inline-block border border-accent-2 px-3 py-2 text-accent-2">{REFUND_COPY[order.refund_status]}</p>
          )}
        </div>
      </div>
    </article>
  );
}
