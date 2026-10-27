import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

// The display face is huge, uppercase and extra-bold. Measured over the site's headlines it is 1.2547x as wide as Arial Bold, so
// "Display Fallback" (globals.css) is Arial Bold scaled to that, and the swap to the real font moves nothing.
const display = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", display: "swap", adjustFontFallback: false, fallback: ["Display Fallback", "ui-sans-serif", "system-ui", "sans-serif"] });
// Body text: measured over the policies page, Manrope is 1.9% wider than Arial (regular) and 1.5% narrower than Arial Bold, and sits
// taller on the line. "Body Fallback" (globals.css) is Arial scaled to match, so long pages don't reflow when the font arrives.
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", adjustFontFallback: false, fallback: ["Body Fallback", "ui-sans-serif", "system-ui", "sans-serif"] });
// Nearly every mono label is UPPERCASE with tracking, and the automatic Arial-based fallback is sized for mixed-case text, so the
// swap to JetBrains Mono shifted the layout. Every monospace face is 0.6em wide, so a monospace fallback matches exactly.
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", adjustFontFallback: false, fallback: ["Mono Fallback", "ui-monospace", "Menlo", "Consolas", "monospace"] });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = `${s.brand} — Personalised campus hoodies`;
  const description = `Preorder a hoodie with your name on the back. Made to order in batches and picked up at ${s.pickupLocation}, IIT Bombay.`;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s — ${s.brand}` },
    description,
    applicationName: s.brand,
    openGraph: { type: "website", siteName: s.brand, title, description, images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "A black hoodie with red flame stitching and the words Wear the campus" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.jpg"] },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

// Runs before the first paint: `js` lets the CSS hide headlines that will be revealed, `booted` skips the home preloader
// for visitors who already saw it this session.
const BOOT_SCRIPT = "(function(){var d=document.documentElement;d.classList.add('js');try{if(sessionStorage.getItem('merch-boot'))d.classList.add('booted')}catch(e){}})()";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <noscript>
          <style>{`.rv[data-rv="view"] .rv-i{transform:none}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
