import type { NameSpot } from "@/lib/name-spots";

type Props = { name: string; spot: NameSpot; body: string; ink: string; placeholder?: string };

// The typed name drawn where it gets printed on the back still, in varsity outline lettering and the print colour.
export function BackName({ name, spot, body, ink, placeholder = "YOUR NAME" }: Props) {
  const text = name || placeholder;
  return (
    <p
      aria-hidden
      className={`varsity pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${name ? "" : "opacity-40"}`}
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, color: body, ["--ink" as string]: ink, fontSize: `min(${spot.size}cqw, calc(${spot.maxWidth}cqw / ${Math.max(text.length * 0.78, 4)}))` }}
    >
      {text}
    </p>
  );
}
