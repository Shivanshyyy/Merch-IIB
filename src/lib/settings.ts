import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { defaultSettings, type Settings } from "@/config/site";
import { db } from "@/lib/db";
import { mergeSettings } from "@/lib/settings-schema";

// Optional env vars (e.g. on Vercel) that pin the pickup point; they win over Admin → Settings.
export function pickupFromEnv(): Partial<Pick<Settings, "pickupLocation" | "pickupRoom">> {
  const location = process.env.PICKUP_LOCATION?.trim();
  const room = process.env.PICKUP_ROOM?.trim();
  return {
    ...(location ? { pickupLocation: location } : {}),
    ...(room ? { pickupRoom: /^\d+$/.test(room) ? `Room ${room}` : room } : {}), // "7131" reads as "Room 7131"
  };
}

async function load(): Promise<Settings> {
  try {
    return { ...mergeSettings(await db().getSettings()), ...pickupFromEnv() };
  } catch (e) {
    // A database hiccup should degrade to defaults, not take every page down.
    console.error("[settings] falling back to defaults:", e);
    return { ...defaultSettings, ...pickupFromEnv() };
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
