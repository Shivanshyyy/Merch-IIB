import "server-only";
import QRCode from "qrcode";
import type { Settings } from "@/config/site";

// "@" stays literal in pa and spaces are %20, because some UPI apps mishandle %40 and "+".
export function upiLink(s: Pick<Settings, "upiId" | "payeeName">, totalInr: number, orderCode: string) {
  return `upi://pay?pa=${s.upiId}&pn=${encodeURIComponent(s.payeeName)}&am=${totalInr.toFixed(2)}&cu=INR&tn=${encodeURIComponent(orderCode)}`;
}

// Dark-on-light for scanner reliability; returned as a data URL so it works in a plain <img>.
export async function upiQrDataUrl(link: string) {
  const svg = await QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#0A0A0B", light: "#EDEBE6" } });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
