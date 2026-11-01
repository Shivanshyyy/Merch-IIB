// The typed name, drawn over the blank name spot on the back still in the same varsity outline style.
export function BackName({ name, placeholder = "YOUR NAME" }: { name: string; placeholder?: string }) {
  const text = name || placeholder;
  return (
    <p
      aria-hidden
      className={`varsity pointer-events-none absolute left-[50.5%] top-[83%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${name ? "" : "opacity-40"}`}
      style={{ fontSize: `min(9cqw, calc(62cqw / ${Math.max(text.length * 0.78, 4)}))` }}
    >
      {text}
    </p>
  );
}
