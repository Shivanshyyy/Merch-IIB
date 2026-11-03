import { Suspense, type ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { FlyToCart } from "@/components/cart/FlyToCart";
import { AccountMenu, AccountSkeleton } from "@/components/layout/AccountMenu";
import { Footer } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import { SettingsProvider } from "@/components/SettingsProvider";
import { getSettings } from "@/lib/settings";

// Shared customer-facing shell. Kept deliberately plain for the simple luxury theme:
// no film grain, custom cursor, route wipe or marquee strip.
export async function SiteChrome({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <SettingsProvider settings={settings}>
      <Nav
        strip={null}
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
    </SettingsProvider>
  );
}
