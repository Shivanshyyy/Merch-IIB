// Next.js signals (redirect(), notFound(), "this needs a request" during prerender) travel as thrown errors that carry
// a `digest`. A catch-all must let them through, or a pre-rendered page can bake in the "no request" fallback.
export function rethrowNextSignals(error: unknown): void {
  if (typeof error === "object" && error !== null && "digest" in error) throw error;
}
