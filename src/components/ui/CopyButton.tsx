"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { buzz } from "@/lib/haptics";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews: fall back to a temporary textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label, toastMessage }: { text: string; label: string; toastMessage: string }) {
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        if (!(await copy(text))) return toast({ message: "Couldn't copy. Select and copy manually." });
        buzz(10);
        setDone(true);
        toast({ message: toastMessage });
        setTimeout(() => setDone(false), 1800);
      }}
      className="btn btn-quiet min-h-12 !px-4"
    >
      <span className="btn-fill" aria-hidden />
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            // Tick draws itself in after the copy glyph fades out.
            <motion.path key="tick" d="M5 12.5 10 17.5 19 7" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.28, ease: "easeOut" }} />
          ) : (
            <motion.g key="copy" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.15 }}>
              <rect x="9" y="9" width="11" height="11" rx="1" />
              <path d="M5 15V5a1 1 0 0 1 1-1h10" />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
      <span>{done ? "Copied" : "Copy"}</span>
    </button>
  );
}
