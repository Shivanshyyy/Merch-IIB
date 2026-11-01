"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { applyOrderAction } from "@/actions/admin/orders";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { OrderChip, PaymentChip, RefundChip } from "@/components/admin/status";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { useToast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { fmtShort } from "@/lib/admin/dates";
import { canFulfil, canRefund, type OrderAction } from "@/lib/admin/order-flow";
import { customerWhatsApp, type Template } from "@/lib/admin/whatsapp";
import { fmtDate, inr } from "@/lib/format";
import type { Order, OrderEvent } from "@/lib/types";

const EVENT_LABEL: Record<string, string> = {
  placed: "Order placed",
  utr_submitted: "Customer shared a UTR",
  payment_verified: "Payment verified",
  payment_rejected: "Payment rejected",
  payment_reset: "Payment set back to pending",
  status_placed: "Moved back to placed",
  status_in_production: "Moved to production",
  status_ready: "Marked ready for pickup",
  status_collected: "Marked collected",
  status_cancelled: "Order cancelled",
  refund_none: "Refund cleared",
  refund_requested: "Refund started",
  refund_approved: "Refund approved",
  refund_refunded: "Refund completed",
  item_edited: "Item edited",
  note_updated: "Note updated",
};

type Props = {
  order: Order;
  events: OrderEvent[];
  batchName: string;
  closeHref: string;
  templates: Template[];
  defaultTemplate: string;
  sizesBySlug: Record<string, string[]>;
  customerHref: string | null;
};

export function OrderDrawer({ order, events, batchName, closeHref, templates, defaultTemplate, sizesBySlug, customerHref }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const close = () => router.push(closeHref, { scroll: false });
  useFocusTrap(panel, true, close);

  const run = (action: OrderAction) =>
    start(async () => {
      const r = await applyOrderAction(order.id, action);
      toast({ message: r.message ?? (r.ok ? "Done" : "Something went wrong") });
    });

  const fulfil = canFulfil(order);
  const refundable = canRefund(order);
  const section = "border-t border-line px-5 py-5";
  const h = "admin-label mb-3 font-medium uppercase tracking-[0.08em]";

  return (
    <div className="fixed inset-0 z-[110]">
      <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close} aria-hidden />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.code}`}
        className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-line bg-bg"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        aria-busy={pending}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="mono text-2xl tracking-[-0.02em]">{order.code}</p>
            <p className="admin-label mt-1">
              {order.full_name} · placed {fmtDate(order.created_at)} · {batchName}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <PaymentChip status={order.payment_status} />
              <OrderChip status={order.order_status} />
              {order.refund_status !== "none" && <RefundChip status={order.refund_status} />}
            </div>
          </div>
          <button type="button" data-autofocus onClick={close} className="admin-label flex min-h-11 shrink-0 items-center px-2 hover:text-fg" aria-label="Close order">
            Close ✕
          </button>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${pending ? "opacity-60" : ""}`}>
          {/* Payment */}
          <section className={section} aria-labelledby="pay-h">
            <h3 id="pay-h" className={h}>
              Payment
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.9rem]">
              <dt className="text-muted">Total</dt>
              <dd className="mono">{inr(order.total_inr)}</dd>
              <dt className="text-muted">UTR</dt>
              <dd className="flex flex-wrap items-center gap-3">
                {order.utr ? (
                  <>
                    <span className="mono break-all">{order.utr}</span>
                    <CopyButton text={order.utr} label="Copy UTR" toastMessage="UTR copied" />
                  </>
                ) : (
                  <span className="text-muted">Not shared yet</span>
                )}
              </dd>
              {order.verified_at && (
                <>
                  <dt className="text-muted">Verified</dt>
                  <dd>{fmtDate(order.verified_at)}</dd>
                </>
              )}
              {order.freebie && (
                <>
                  <dt className="text-muted">Freebie</dt>
                  <dd className="text-accent-2">✦ Yes: hand over the freebies at pickup</dd>
                </>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.payment_status !== "verified" && (
                <Button size="md" className="btn-sm" onClick={() => run({ type: "verify" })} disabled={pending}>
                  Verify payment
                </Button>
              )}
              {order.payment_status === "pending" && (
                <ConfirmButton onConfirm={() => run({ type: "reject" })} disabled={pending}>
                  Reject payment
                </ConfirmButton>
              )}
              {order.payment_status !== "pending" && (
                <ConfirmButton onConfirm={() => run({ type: "reset_payment" })} disabled={pending}>
                  Back to pending
                </ConfirmButton>
              )}
            </div>
          </section>

          {/* Fulfilment */}
          <section className={section} aria-labelledby="ful-h">
            <h3 id="ful-h" className={h}>
              Fulfilment
            </h3>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["in_production", "Move to production", "✓ In production"],
                  ["ready", "Mark ready", "✓ Ready for pickup"],
                  ["collected", "Mark collected", "✓ Collected"],
                ] as const
              ).map(([status, label, current]) => {
                const here = order.order_status === status;
                return (
                  <Button key={status} variant={here ? "ghost" : "quiet"} className={`btn-sm ${here ? "btn-current" : ""}`} disabled={pending || !fulfil || here} aria-pressed={here} onClick={() => run({ type: "status", status })}>
                    {here ? current : label}
                  </Button>
                );
              })}
              {order.order_status === "cancelled" ? (
                <Button variant="ghost" className="btn-sm" disabled={pending} onClick={() => run({ type: "status", status: "placed" })}>
                  Reopen order
                </Button>
              ) : (
                <ConfirmButton onConfirm={() => run({ type: "status", status: "cancelled" })} disabled={pending}>
                  Cancel order
                </ConfirmButton>
              )}
            </div>
            {!fulfil && order.order_status !== "cancelled" && <p className="admin-label mt-3">Verify the payment to unlock these.</p>}
          </section>

          {/* Refund */}
          <section className={section} aria-labelledby="ref-h">
            <h3 id="ref-h" className={h}>
              Refund
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {order.refund_status === "none" && (
                <Button variant="quiet" className="btn-sm" disabled={pending || !refundable} onClick={() => run({ type: "refund", refund: "requested" })}>
                  Start refund
                </Button>
              )}
              {order.refund_status === "requested" && (
                <Button variant="quiet" className="btn-sm" disabled={pending} onClick={() => run({ type: "refund", refund: "approved" })}>
                  Approve refund
                </Button>
              )}
              {(order.refund_status === "requested" || order.refund_status === "approved") && (
                <Button variant="quiet" className="btn-sm" disabled={pending} onClick={() => run({ type: "refund", refund: "refunded" })}>
                  Mark refunded
                </Button>
              )}
              {order.refund_status !== "none" && (
                <ConfirmButton onConfirm={() => run({ type: "refund", refund: "none" })} disabled={pending}>
                  Clear refund
                </ConfirmButton>
              )}
            </div>
            {order.refund_status === "none" && !refundable && <p className="admin-label mt-3">Only an order with a verified payment can be refunded.</p>}
          </section>

          {/* Items */}
          <section className={section} aria-labelledby="items-h">
            <h3 id="items-h" className={h}>
              Items
            </h3>
            <ul className="grid gap-5">
              {order.items.map((it, i) => (
                <ItemRow key={`${i}-${it.name}-${it.size}`} item={it} index={i} sizes={sizesBySlug[it.slug]} busy={pending} onSave={(a) => run({ type: "edit_item", index: i, ...a })} />
              ))}
            </ul>
          </section>

          {/* Customer */}
          <section className={section} aria-labelledby="cust-h">
            <h3 id="cust-h" className={h}>
              Customer
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.9rem]">
              <dt className="text-muted">Name</dt>
              <dd>{order.full_name}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="break-all">{order.email}</dd>
              <dt className="text-muted">Phone</dt>
              <dd>
                <a href={`tel:+91${order.phone}`} className="mono underline underline-offset-4 hover:text-accent-2">
                  {order.phone}
                </a>
              </dd>
              <dt className="text-muted">Pickup</dt>
              <dd>
                {order.hostel}, room {order.room}
              </dd>
            </dl>
            {customerHref && (
              <Link href={customerHref} className="admin-label mt-3 inline-block underline underline-offset-4 hover:text-fg">
                View customer →
              </Link>
            )}
            <WhatsApp key={order.payment_status + order.order_status + order.refund_status} phone={order.phone} templates={templates} initial={defaultTemplate} />
          </section>

          {/* Note */}
          <NoteForm key={order.admin_note ?? ""} note={order.admin_note ?? ""} busy={pending} onSave={(note) => run({ type: "note", note })} className={section} headingClass={h} />

          {/* History */}
          <section className={section} aria-labelledby="hist-h">
            <h3 id="hist-h" className={h}>
              History
            </h3>
            <ol className="grid gap-3">
              {events.map((e) => (
                <li key={e.id} className="grid grid-cols-[6.5rem_1fr] gap-3 text-[0.85rem]">
                  <span className="text-muted">{fmtShort(e.created_at)}</span>
                  <span>
                    {EVENT_LABEL[e.type] ?? e.type}
                    {e.note && <span className="block break-words text-muted">{e.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

function ItemRow({ item, index, sizes, busy, onSave }: { item: Order["items"][number]; index: number; sizes?: string[]; busy: boolean; onSave: (a: { name: string; size: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [size, setSize] = useState(item.size);

  return (
    <li className="text-[0.9rem]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {item.productName} <span className="text-muted">×{item.qty}</span>
          </p>
          <p className="admin-label mt-0.5">
            {item.colorway} · size {item.size} · {inr(item.unitPriceInr)} each
          </p>
          <p className="mono mt-1 text-accent-2">{item.name || <span className="text-muted">No name</span>}</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="admin-label flex min-h-11 shrink-0 items-center px-2 underline underline-offset-4 hover:text-fg" aria-label={`Edit item ${index + 1}`}>
            Edit
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-3 grid gap-3 border border-line bg-bg-2 p-3">
          <label className="grid gap-1">
            <span className="admin-label">Name on the back</span>
            <input className="input !min-h-11" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} spellCheck={false} />
          </label>
          <label className="grid gap-1">
            <span className="admin-label">Size</span>
            {sizes?.length ? (
              <select className="input !min-h-11" value={size} onChange={(e) => setSize(e.target.value)}>
                {sizes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input className="input !min-h-11" value={size} onChange={(e) => setSize(e.target.value)} maxLength={8} />
            )}
          </label>
          <div className="flex gap-2">
            <Button className="btn-sm" disabled={busy} onClick={() => (onSave({ name, size }), setEditing(false))}>
              Save item
            </Button>
            <Button variant="ghost" className="btn-sm" onClick={() => (setName(item.name), setSize(item.size), setEditing(false))}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function WhatsApp({ phone, templates, initial }: { phone: string; templates: Template[]; initial: string }) {
  const [key, setKey] = useState(initial);
  const [text, setText] = useState(templates.find((t) => t.key === initial)?.text ?? "");
  return (
    <div className="mt-5 grid gap-3 border border-line bg-bg-2 p-3">
      <label className="grid gap-1">
        <span className="admin-label">WhatsApp message</span>
        <select
          className="input !min-h-11"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setText(templates.find((t) => t.key === e.target.value)?.text ?? "");
          }}
        >
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="sr-only">Message text</span>
        <textarea className="input min-h-28" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div>
        <Button href={customerWhatsApp(phone, text)} target="_blank" rel="noopener" variant="quiet" className="btn-sm">
          Open in WhatsApp
        </Button>
      </div>
    </div>
  );
}

function NoteForm({ note, busy, onSave, className, headingClass }: { note: string; busy: boolean; onSave: (n: string) => void; className: string; headingClass: string }) {
  const [value, setValue] = useState(note);
  return (
    <section className={className} aria-labelledby="note-h">
      <h3 id="note-h" className={headingClass}>
        Admin note
      </h3>
      <textarea className="input min-h-24" value={value} onChange={(e) => setValue(e.target.value)} maxLength={1000} placeholder="Only you can see this." aria-label="Note for this order" />
      <div className="mt-3">
        <Button variant="quiet" className="btn-sm" disabled={busy || value.trim() === note.trim()} onClick={() => onSave(value)}>
          Save note
        </Button>
      </div>
    </section>
  );
}
