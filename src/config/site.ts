// Every business constant lives here so non-coders can edit it. Search for TODO to find what still needs a real value.
export const site = {
  brand: "MERCH—IITB", // TODO: final brand name
  domain: "TBD", // TODO: e.g. merch-iitb.shop
  upi: { id: "TODO@upi", payeeName: "Aryan TODO" }, // TODO: real UPI ID + payee name
  contact: { name: "Aryan", phone: "91XXXXXXXXXX", whatsapp: "91XXXXXXXXXX" }, // TODO: real numbers, country code first, digits only
  pickup: { location: "Hostel 4", room: "TODO", hours: "TODO" }, // TODO: room + collection hours
  refundWindowDays: 5,
  nameMaxLength: 12,
  maxPendingOrdersPerEmail: 3,
  orderCodePrefix: "HD",
  maxQtyPerLine: 10,
  nameUppercase: true, // TODO: confirm with vendor whether names print in capitals
  modelCredit: {
    title: "Classic Black Flame Hoodie",
    author: "kril",
    url: "https://sketchfab.com/3d-models/classic-black-flame-hoodie-0fd0effa321e456cb2a7467e2899b658",
    license: "CC BY 4.0",
  },
  // TODO: replace with the vendor's real size chart (chest/length in cm). Shown in the size-chart modal.
  sizeChart: {
    unit: "cm",
    columns: ["Chest", "Length", "Sleeve"],
    rows: {
      S: ["TODO", "TODO", "TODO"],
      M: ["TODO", "TODO", "TODO"],
      L: ["TODO", "TODO", "TODO"],
      XL: ["TODO", "TODO", "TODO"],
      XXL: ["TODO", "TODO", "TODO"],
    },
  },
  // TODO: fabric spec numbers must come from the vendor; shown as-is on the product page and home "The Fabric" section.
  fabricSpecs: [
    { label: "Fabric", value: "TODO" },
    { label: "Weight", value: "TODO" },
    { label: "Fit", value: "TODO" },
  ],
} as const;

export type Site = typeof site;

export const whatsappLink = (text: string) => `https://wa.me/${site.contact.whatsapp}?text=${encodeURIComponent(text)}`;
