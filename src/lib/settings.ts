import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { defaultSettings, type Settings } from "@/config/site";
import { db } from "@/lib/db";
import { mergeSettings } from "@/lib/settings-schema";

async function load(): Promise<Settings> {
  try {
    return mergeSettings(await db().getSettings());
  } catch (e) {
    // A database hiccup should degrade to defaults, not take every page down.
    console.error("[settings] falling back to defaults:", e);
    return defaultSettings;
  }
}

// For rendering. Cached; saving in /admin/settings invalidates the "settings" tag.
export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheTag("settings");
  cacheLife("minutes");
  return load();
}

// Uncached: server actions that validate input or decide money read this.
export const getSettingsFresh = load;
