// A simple hoodie drawn in SVG, tinted with a colourway. Used where there is no studio photo (a colourway added in admin).
export function HoodieGlyph({ body, stitch = "#ff3b1f", className = "" }: { body: string; stitch?: string; className?: string }) {
  const dark = `color-mix(in srgb, ${body} 72%, black)`;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Hoodie" className={className}>
      <path d="M68 40C58 44 40 52 30 62L12 150c-1 6 4 10 10 8l18-4 6-42v58c0 6 4 10 10 10h88c6 0 10-4 10-10v-58l6 42 18 4c6 2 11-2 10-8L170 62c-10-10-28-18-38-22Z" fill={body} stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
      <path d="M68 40c4-16 18-24 32-24s28 8 32 24c-6 14-18 22-32 22S74 54 68 40Z" fill={dark} />
      <path d="M86 58v26M114 58v26" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
      <path d="M66 118h68l6 34H60Z" fill="none" stroke={stitch} strokeWidth="1.6" strokeDasharray="3 3" />
      <path d="M46 160h108" stroke={stitch} strokeWidth="1.6" strokeDasharray="3 3" opacity="0.8" />
    </svg>
  );
}
