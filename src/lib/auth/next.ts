// Only same-site paths may be used as a post-login destination (no open redirects).
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

export const loginPath = (next: string) => `/login?next=${encodeURIComponent(next)}`;
