// All admin dates are shown and entered in IST, whatever the server's or the browser's timezone.
const IST_OFFSET = "+05:30";

export const fmtShort = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

// ISO instant -> "YYYY-MM-DDTHH:mm" in IST, for <input type="datetime-local">.
export function toIstInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return parts.replace(" ", "T");
}

// "YYYY-MM-DDTHH:mm" typed in IST -> ISO instant (or null when invalid).
export function fromIstInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00${IST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ISO instant `days` from now (kept out of components, which must stay pure).
export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
