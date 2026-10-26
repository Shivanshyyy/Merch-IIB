"use client";

import Link from "next/link";
import type { ComponentProps, PointerEvent, ReactNode } from "react";

type Common = {
  variant?: "primary" | "ghost" | "quiet";
  size?: "md" | "lg";
  block?: boolean;
  loading?: boolean;
  className?: string;
  children: ReactNode;
};
type AsButton = Common & Omit<ComponentProps<"button">, keyof Common> & { href?: undefined };
type AsLink = Common & Omit<ComponentProps<"a">, keyof Common | "href"> & { href: string };

// Record where the pointer touched the button so the fill grows from that edge, and shrinks back out the exit edge.
function setOrigin(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  const far = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
  el.style.setProperty("--fx", `${x}px`);
  el.style.setProperty("--fy", `${y}px`);
  el.style.setProperty("--r", `${Math.ceil(far * 2 + 4)}px`);
}

export function Button(props: AsButton | AsLink) {
  const { variant = "primary", size = "md", block, loading, className = "", children, ...rest } = props;
  const cls = ["btn", variant === "ghost" && "btn-ghost", variant === "quiet" && "btn-quiet", size === "lg" && "btn-lg", block && "btn-block", className].filter(Boolean).join(" ");
  const inner = (
    <>
      <span className="btn-fill" aria-hidden />
      {loading && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      <span>{children}</span>
    </>
  );
  const pointer = { onPointerEnter: setOrigin, onPointerLeave: setOrigin };

  if ("href" in props && props.href !== undefined) {
    const { href, ...a } = rest as Omit<AsLink, keyof Common>;
    const internal = href.startsWith("/");
    return internal ? (
      <Link href={href} className={cls} {...pointer} {...a}>
        {inner}
      </Link>
    ) : (
      <a href={href} className={cls} {...pointer} {...a}>
        {inner}
      </a>
    );
  }
  const b = rest as Omit<AsButton, keyof Common>;
  return (
    <button type="button" className={cls} {...pointer} {...b} disabled={b.disabled || loading} aria-busy={loading || undefined}>
      {inner}
    </button>
  );
}
