// Tiny tick on supported phones (add-to-cart, copy UPI ID). Silently no-ops elsewhere.
export const buzz = (ms = 10) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
};
