import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

// Lets a phone "Add to Home Screen" and open it like an app.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: `${s.brand}: personalised campus hoodies`,
    short_name: s.brand,
    description: `Preorder a hoodie with your name on the back. Pickup at ${s.pickupLocation}, IIT Bombay.`,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
