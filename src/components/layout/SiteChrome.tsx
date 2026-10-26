import { Suspense, type ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AccountMenu, AccountSkeleton } from "@/components/layout/AccountMenu";
import { Footer } from "@/components/layout/Footer";
import { Grain } from "@/components/layout/Grain";
import { Nav } from "@/components/layout/Nav";
import { SettingsProvider } from "@/components/SettingsProvider";
import { getSettings } from "@/lib/settings";

// Everything a customer-facing page shares. The admin panel has its own shell.
export async function SiteChrome({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <SettingsProvider settings={settings}>
      <Nav
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
      <Grain />
    </SettingsProvider>
  );
}
