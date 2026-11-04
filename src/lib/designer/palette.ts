import type { Colorway } from "@/lib/types";

// Garment colours a designer can propose; the admin can change them when publishing.
export const GARMENT_COLOURS: Colorway[] = [
  { name: "Black", body: "#0E0E10", stitch: "#FFFFFF" },
  { name: "White", body: "#F4F4F2", stitch: "#5A1A22" },
  { name: "Navy Blue", body: "#1B2A4E", stitch: "#FFFFFF" },
  { name: "Maroon", body: "#5A1A22", stitch: "#F3E9E6" },
  { name: "Grey", body: "#8A8D91", stitch: "#16140F" },
  { name: "Olive", body: "#4B5233", stitch: "#F3E9E6" },
  { name: "Beige", body: "#D9CBB0", stitch: "#16140F" },
  { name: "Forest Green", body: "#1F3D2E", stitch: "#F3E9E6" },
];

export const colourByName = (name: string) => GARMENT_COLOURS.find((c) => c.name === name);
