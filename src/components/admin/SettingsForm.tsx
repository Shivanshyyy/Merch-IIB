"use client";

import { useActionState, useEffect, useState } from "react";
import { saveSettings } from "@/actions/admin/settings";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import type { FabricSpec, Settings } from "@/config/site";
import type { FormState } from "@/lib/form-state";
import { settingsSchema } from "@/lib/settings-schema";

type ChartRow = { size: string; cells: string[] };

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="admin-card p-5" aria-label={title}>
    <h2 className="text-[1rem] font-semibold">{title}</h2>
    {hint && <p className="admin-label mb-5 mt-1">{hint}</p>}
    <div className={hint ? "" : "mt-5"}>{children}</div>
  </section>
);

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState<FormState, FormData>(saveSettings, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const shape = settingsSchema.shape;
  const v = (k: keyof Settings) => state.values?.[k] ?? String(settings[k]);
  const pv = (k: string, fallback: string) => state.values?.[k] ?? fallback;

  // Size chart: unit + column names + one row per size.
  const [unit, setUnit] = useState(settings.sizeChart.unit);
  const [columns, setColumns] = useState(settings.sizeChart.columns);
  const [rows, setRows] = useState<ChartRow[]>(Object.entries(settings.sizeChart.rows).map(([size, cells]) => ({ size, cells: columns.map((_, i) => cells[i] ?? "") })));
  const chart = { unit, columns, rows: Object.fromEntries(rows.filter((r) => r.size.trim()).map((r) => [r.size.trim().toUpperCase(), r.cells])) };
  const [specs, setSpecs] = useState<FabricSpec[]>(settings.fabricSpecs);

  useEffect(() => {
    if (state.message) toast({ message: state.message });
  }, [state, toast]);

  const cell = "input !min-h-10 !px-2 !py-1 text-[0.9rem]";

  return (
    <form action={action} noValidate className="grid gap-6">
      <input type="hidden" name="sizeChart" value={JSON.stringify(chart)} />
      <input type="hidden" name="fabricSpecs" value={JSON.stringify(specs.filter((s) => s.label.trim() || s.value.trim()))} />

      <Section title="Brand & contact" hint="Shown across the site and in WhatsApp messages.">
        <div className="grid gap-x-5 sm:grid-cols-2">
          <TextField label="Brand name" name="brand" defaultValue={v("brand")} error={f.error("brand")} onBlur={f.validate("brand", shape.brand)} required />
          <TextField label="Contact person" name="contactName" defaultValue={v("contactName")} error={f.error("contactName")} onBlur={f.validate("contactName", shape.contactName)} help="Who customers message, e.g. Aryan" required />
          <TextField label="Phone" name="phone" type="tel" defaultValue={v("phone")} error={f.error("phone")} help="Digits only, country code first: 919876543210" required />
          <TextField label="WhatsApp number" name="whatsapp" type="tel" defaultValue={v("whatsapp")} error={f.error("whatsapp")} help="Often the same as the phone" required />
        </div>
      </Section>

      <Section title="Payments" hint="Customers pay to this UPI ID. Changes apply to every order that hasn't been paid yet.">
        <div className="grid gap-x-5 sm:grid-cols-2">
          <TextField label="UPI ID" name="upiId" defaultValue={v("upiId")} error={f.error("upiId")} onBlur={f.validate("upiId", shape.upiId)} autoCapitalize="none" spellCheck={false} help="e.g. aryan@oksbi" required />
          <TextField label="Payee name" name="payeeName" defaultValue={v("payeeName")} error={f.error("payeeName")} onBlur={f.validate("payeeName", shape.payeeName)} help="Shown in the UPI app" required />
        </div>
      </Section>

      <Section title="Pickup & refunds" hint="Shown on the pay page, policies and checkout.">
        <div className="grid gap-x-5 sm:grid-cols-3">
          <TextField label="Pickup location" name="pickupLocation" defaultValue={v("pickupLocation")} error={f.error("pickupLocation")} required />
          <TextField label="Room" name="pickupRoom" defaultValue={v("pickupRoom")} error={f.error("pickupRoom")} help="e.g. Room 112" required />
          <TextField label="Hours" name="pickupHours" defaultValue={v("pickupHours")} error={f.error("pickupHours")} help="e.g. 6–9 pm, weekdays" required />
          <TextField label="Refund window (days)" name="refundWindowDays" type="number" inputMode="numeric" min={0} max={90} defaultValue={v("refundWindowDays")} error={f.error("refundWindowDays")} help="Days after pickup" required />
        </div>
      </Section>

      <Section title="Ordering rules">
        <div className="grid gap-x-5 sm:grid-cols-3">
          <TextField label="Max characters in a name" name="nameMaxLength" type="number" inputMode="numeric" min={1} max={30} defaultValue={v("nameMaxLength")} error={f.error("nameMaxLength")} required />
          <TextField label="Unpaid orders per customer" name="maxPendingOrdersPerEmail" type="number" inputMode="numeric" min={1} max={20} defaultValue={v("maxPendingOrdersPerEmail")} error={f.error("maxPendingOrdersPerEmail")} help="Stops people stacking unpaid orders" required />
          <label className="flex items-center gap-3 self-center sm:mt-2">
            <input type="checkbox" name="nameUppercase" defaultChecked={state.values ? undefined : settings.nameUppercase} className="size-5 accent-[var(--accent)]" />
            <span className="text-[0.9rem]">Print names in capitals</span>
          </label>
        </div>
      </Section>

      <Section title="Size chart" hint="The measurements customers see in the size-chart popup. Add a row per size you sell.">
        <div className="grid gap-4">
          <label className="grid max-w-32 gap-1">
            <span className="admin-label">Unit</span>
            <input className={cell} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={8} />
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="admin-label w-24 text-left font-normal">Size</th>
                  {columns.map((c, i) => (
                    <th key={i} className="font-normal">
                      <input
                        className={cell}
                        aria-label={`Column ${i + 1} name`}
                        value={c}
                        onChange={(e) => setColumns((cols) => cols.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    </th>
                  ))}
                  <th className="relative w-10"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri}>
                    <td>
                      <input className={`${cell} mono`} aria-label={`Row ${ri + 1} size`} value={r.size} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === ri ? { ...x, size: e.target.value } : x)))} maxLength={8} />
                    </td>
                    {columns.map((_, ci) => (
                      <td key={ci}>
                        <input
                          className={cell}
                          aria-label={`${r.size || `Row ${ri + 1}`} ${columns[ci]}`}
                          value={r.cells[ci] ?? ""}
                          onChange={(e) => setRows((rs) => rs.map((x, j) => (j === ri ? { ...x, cells: x.cells.map((c, k) => (k === ci ? e.target.value : c)) } : x)))}
                          maxLength={12}
                        />
                      </td>
                    ))}
                    <td>
                      <button type="button" className="admin-label min-h-10 px-1 hover:text-fg" aria-label={`Remove size ${r.size || ri + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== ri))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" className="btn-sm" onClick={() => setRows((rs) => [...rs, { size: "", cells: columns.map(() => "") }])}>
              Add size
            </Button>
            <Button
              variant="quiet"
              className="btn-sm"
              disabled={columns.length >= 6}
              onClick={() => {
                setColumns((c) => [...c, ""]);
                setRows((rs) => rs.map((r) => ({ ...r, cells: [...r.cells, ""] })));
              }}
            >
              Add column
            </Button>
            <Button
              variant="ghost"
              className="btn-sm"
              disabled={columns.length <= 1}
              onClick={() => {
                setColumns((c) => c.slice(0, -1));
                setRows((rs) => rs.map((r) => ({ ...r, cells: r.cells.slice(0, -1) })));
              }}
            >
              Remove last column
            </Button>
          </div>
          {f.error("sizeChart") && (
            <p role="alert" className="field-error">
              The size chart has a blank column name or a value that is too long.
            </p>
          )}
        </div>
      </Section>

      <Section title="Cart discounts" hint="Applied automatically at checkout. If an order qualifies for both, only the bigger one applies. Set a % to 0 to switch it off.">
        <div className="grid gap-x-5 sm:grid-cols-3">
          <TextField label="Hoodie + T-shirt combo (% off)" name="offerCombo" type="number" inputMode="numeric" min={0} max={50} defaultValue={pv("offerCombo", String(settings.offers.comboPercent))} error={f.error("offers")} help="Cart has at least one of each" required />
          <TextField label="Big order: above (₹)" name="offerBulkAbove" type="number" inputMode="numeric" min={0} defaultValue={pv("offerBulkAbove", String(settings.offers.bulkAbove))} help="Item total must be more than this" required />
          <TextField label="Big order (% off)" name="offerBulkPercent" type="number" inputMode="numeric" min={0} max={50} defaultValue={pv("offerBulkPercent", String(settings.offers.bulkPercent))} required />
        </div>
      </Section>

      <Section title="Freebies offer" hint="E.g. the first 200 paid orders get a keychain and stickers. A spot is claimed when you verify an order's payment, and given back if you reject or reset it.">
        <label className="mb-5 flex items-center gap-3">
          <input type="checkbox" name="promoEnabled" defaultChecked={state.values ? state.values.promoEnabled === "on" : settings.promo.enabled} className="size-5 accent-[var(--accent)]" />
          <span className="text-[0.9rem]">Offer is on (shows on the site and tags verified orders)</span>
        </label>
        <div className="grid gap-x-5 sm:grid-cols-[2fr_1fr]">
          <TextField label="Headline" name="promoTitle" defaultValue={pv("promoTitle", settings.promo.title)} error={f.error("promo")} help="e.g. First 200 customers get freebies" maxLength={80} required />
          <TextField label="Number of spots" name="promoLimit" type="number" inputMode="numeric" min={1} max={10000} defaultValue={pv("promoLimit", String(settings.promo.limit))} help="First N paid orders" required />
        </div>
        <div className="field">
          <label htmlFor="promoItems" className="label">
            <span>Freebies, one per line</span>
          </label>
          <textarea id="promoItems" name="promoItems" defaultValue={pv("promoItems", settings.promo.items.join("\n"))} className="input min-h-24" placeholder={"IIT Bombay keychain\nIITB cultural stickers"} />
          <div className="mt-2 min-h-[1.5rem]" />
        </div>
        <TextField label="Small print" name="promoNote" defaultValue={pv("promoNote", settings.promo.note)} help="Optional, e.g. Handed over with your hoodie at pickup." maxLength={140} />
      </Section>

      <Section title="Fabric specs" hint="Shown on the home page. Use numbers only once the vendor has confirmed them.">
        <ul className="grid gap-2">
          {specs.map((s, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input className={cell} aria-label={`Spec ${i + 1} label`} placeholder="Label, e.g. Weight" value={s.label} onChange={(e) => setSpecs((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={30} />
              <input className={cell} aria-label={`Spec ${i + 1} value`} placeholder="Value, e.g. 320 gsm" value={s.value} onChange={(e) => setSpecs((all) => all.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} maxLength={40} />
              <button type="button" className="admin-label min-h-10 px-1 hover:text-fg" aria-label={`Remove spec ${i + 1}`} onClick={() => setSpecs((all) => all.filter((_, j) => j !== i))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button variant="quiet" className="btn-sm" disabled={specs.length >= 8} onClick={() => setSpecs((all) => [...all, { label: "", value: "" }])}>
            Add spec
          </Button>
        </div>
      </Section>

      {state.message && !state.ok && (
        <p role="alert" className="border border-accent p-3 text-[0.9rem] text-[#ff7a63]">
          {state.message}
        </p>
      )}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
