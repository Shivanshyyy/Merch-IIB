import { Suspense, type ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { FlyToCart } from "@/components/cart/FlyToCart";
import { AccountMenu, AccountSkeleton } from "@/components/layout/AccountMenu";
import { Cursor } from "@/components/layout/Cursor";
import { Footer } from "@/components/layout/Footer";
import { Grain } from "@/components/layout/Grain";
import { Marquee } from "@/components/layout/Marquee";
import { Nav } from "@/components/layout/Nav";
import { PageTransition } from "@/components/layout/PageTransition";
import { SettingsProvider } from "@/components/SettingsProvider";
import { getOpenBatch } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

// Everything a customer-facing page shares. The admin panel has its own shell.
export async function SiteChrome({ children }: { children: ReactNode }) {
  const [settings, batch] = await Promise.all([getSettings(), getOpenBatch()]);
  return (
    <SettingsProvider settings={settings}>
      <Nav
        strip={<Marquee batch={batch ? { name: batch.name, closesAt: batch.closes_at } : null} pickup={settings.pickupLocation} />}
        account={
          <Suspense fallback={<AccountSkeleton />}>
            <AccountMenu />
          </Suspense>
        }
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer settings={settings} />
      <CartDrawer />
      <FlyToCart />
      <Suspense fallback={null}>
        <PageTransition />
      </Suspense>
      <Cursor />
      <Grain />
    </SettingsProvider>
  );
}
