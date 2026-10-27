// The 000 -> 100 counter. Real inputs: how many bytes of the model have arrived, and whether the first frame is drawn.

export type BootInput = { elapsedMs: number; modelBytes: number; modelTotal: number; ready: boolean };

// 0..1. The scene code (size unknown, so time-eased) is the first 15%, the model's bytes the next 75%, and the last 10%
// is held back until the first frame is on screen so the counter never sits at 100 while nothing has appeared.
export function bootProgress({ elapsedMs, modelBytes, modelTotal, ready }: BootInput): number {
  if (ready) return 1;
  const code = 0.15 * (1 - Math.exp(-Math.max(0, elapsedMs) / 900));
  const model = modelTotal > 0 ? Math.min(1, Math.max(0, modelBytes) / modelTotal) : 0;
  return Math.min(0.99, code + 0.75 * model);
}

// "000" .. "100"
export const counterText = (p: number) => String(Math.round(Math.min(1, Math.max(0, p)) * 100)).padStart(3, "0");
