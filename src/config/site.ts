// Fixed constants plus the DEFAULT business values.
// Business values (UPI, phone, pickup, refund days, prices...) are edited in /admin/settings and stored in the
// database; the defaults here only seed that screen and fill any gap. They live in settings.defaults.json so the
// SQL seed, the demo store and the UI share one source.
import defaults from "./settings.defaults.json";

export type SizeChart = { unit: string; columns: string[]; rows: Record<string, string[]> };
export type FabricSpec = { label: string; value: string };
export type Offers = { comboPercent: number; bulkAbove: number; bulkPercent: number };
export type Promo = { enabled: boolean; limit: number; title: string; items: string[]; note: string };

export type Settings = {
  brand: string;
  upiId: string;
  payeeName: string;
  contactName: string;
  phone: string; // digits only, country code first
  whatsapp: string;
  pickupLocation: string;
  pickupRoom: string;
  pickupHours: string;
  refundWindowDays: number;
  nameMaxLength: number;
  nameUppercase: boolean;
  maxPendingOrdersPerEmail: number;
  sizeCharts: { hoodie: SizeChart; tee: SizeChart }; // the popup picks one by product type
  fabricSpecs: FabricSpec[];
  promo: Promo;
  offers: Offers;
};

export const defaultSettings: Settings = defaults;

export const site = {
  orderCodePrefix: "HD",
  maxQtyPerLine: 10,
  // TODO: the current hoodie model has no recorded author or licence. If its licence asks for a credit, fill this in;
  // the footer and policies page show it only once it is set.
  modelCredit: null as { title: string; author: string; url: string; license: string } | null,
} as const;

export const whatsappUrl = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

// "91XXXXXXXXXX" -> "+91 XXXXXXXXXX"
export const formatPhone = (digits: string) => (digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10)}` : digits);
