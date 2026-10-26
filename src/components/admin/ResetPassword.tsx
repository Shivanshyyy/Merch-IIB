"use client";

import { useState, useTransition } from "react";
import { resetCustomerPassword } from "@/actions/admin/customers";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { customerWhatsApp } from "@/lib/admin/whatsapp";

type Props = { userId: string; phone: string; firstName: string; brand: string };

// Customers have no email reset, so the admin sets a new password and sends it over WhatsApp.
export function ResetPassword({ userId, phone, firstName, brand }: Props) {
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string; password?: string } | null>(null);

  const message = (pw: string) => `Hi ${firstName}, your new ${brand} password is: ${pw}\nPlease log in and change it under Account.`;

  return (
    <div className="grid gap-4">
      <label className="grid gap-1">
        <span className="admin-label">New password (leave empty to generate one)</span>
        <input className="input !min-h-11" value={custom} onChange={(e) => setCustom(e.target.value)} autoComplete="off" spellCheck={false} placeholder="At least 8 characters" />
      </label>
      <div>
        <Button
          variant="quiet"
          className="btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resetCustomerPassword(userId, custom);
              setResult(r);
              if (r.ok) setCustom("");
            })
          }
        >
          Set new password
        </Button>
      </div>

      {result && (
        <div role="status" className={`border p-4 ${result.ok ? "border-line bg-bg-2" : "border-accent text-[#ff7a63]"}`}>
          {result.ok && result.password ? (
            <div className="grid gap-3">
              <p className="admin-label">New password. It is shown once, so send it now.</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="mono text-[1.4rem] tracking-[0.04em]">{result.password}</span>
                <CopyButton text={result.password} label="Copy password" toastMessage="Password copied" />
              </div>
              <div>
                <Button href={customerWhatsApp(phone, message(result.password))} target="_blank" rel="noopener" variant="quiet" className="btn-sm">
                  Send on WhatsApp
                </Button>
              </div>
            </div>
          ) : (
            result.message
          )}
        </div>
      )}
    </div>
  );
}
