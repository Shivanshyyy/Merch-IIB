"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logOut } from "@/actions/auth";

export function AccountDropdown({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const initial = (name.trim()[0] ?? email[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "label flex min-h-11 w-full items-center px-4 text-left text-fg transition-colors hover:bg-bg-2 hover:text-accent-2";

  return (
    <div ref={root} className="relative flex h-11 w-[4.5rem] items-center justify-center">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-1.5 px-1 text-fg"
      >
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-fg font-mono text-[0.8rem] font-medium text-bg">
          {initial}
        </span>
        <span aria-hidden className={`text-[0.6rem] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 top-full z-50 mt-2 w-60 border border-line bg-bg shadow-[0_18px_50px_rgba(0,0,0,.6)]">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-[0.95rem] font-medium">{name}</p>
            <p className="label mt-1 truncate normal-case tracking-normal">{email}</p>
          </div>
          <Link role="menuitem" href="/orders" className={item} onClick={() => setOpen(false)}>
            My orders
          </Link>
          <Link role="menuitem" href="/account" className={item} onClick={() => setOpen(false)}>
            Account
          </Link>
          <form action={logOut} className="border-t border-line">
            <button role="menuitem" type="submit" className={item}>
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
