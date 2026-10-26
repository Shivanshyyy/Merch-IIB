"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultSettings, type Settings } from "@/config/site";

// Runtime business values (brand, UPI, pickup, name rules...) for client components.
const Ctx = createContext<Settings>(defaultSettings);

export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ settings, children }: { settings: Settings; children: ReactNode }) {
  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>;
}
