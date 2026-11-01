// Kept apart from HoodieModel.tsx so light code (the preloader) can use them without pulling in three.js.
// next.config.ts fingerprints the file into the address: the model is cached for a week, and a swapped model must be a new URL.
export const HOODIE_URL = `/models/hoodie.glb?v=${process.env.NEXT_PUBLIC_MODEL_VERSION ?? "dev"}`;
export const HOODIE_BYTES = Number(process.env.NEXT_PUBLIC_MODEL_BYTES) || 1_098_416; // size of the optimised model, for the loading counter
