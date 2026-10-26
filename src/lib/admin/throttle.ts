// Best-effort brute-force brake for the admin password: 5 misses per IP per 10 minutes.
// In-memory, so on serverless it is per instance; the constant delay on failure still applies everywhere.
const LIMIT = 5;
const WINDOW_MS = 10 * 60_000;

type Entry = { count: number; first: number };
const g = globalThis as unknown as { __adminThrottle?: Map<string, Entry> };
const map = () => (g.__adminThrottle ??= new Map<string, Entry>());

export function throttleStatus(key: string, now = Date.now()) {
  const e = map().get(key);
  if (!e || now - e.first > WINDOW_MS) return { blocked: false, retryInMinutes: 0 };
  return { blocked: e.count >= LIMIT, retryInMinutes: Math.max(1, Math.ceil((e.first + WINDOW_MS - now) / 60_000)) };
}

export function recordFailure(key: string, now = Date.now()) {
  const e = map().get(key);
  if (!e || now - e.first > WINDOW_MS) map().set(key, { count: 1, first: now });
  else e.count++;
}

export const clearFailures = (key: string) => void map().delete(key);
