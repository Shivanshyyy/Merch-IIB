import Image from "next/image";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <SiteChrome>
    <div className="page ember relative min-h-[100svh] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[var(--nav-h)] mx-auto aspect-square w-[min(80vw,520px)] origin-top [animation:fall_2.6s_cubic-bezier(.55,0,.9,.4)_0.4s_forwards]">
        <Image src="/products/midnight-flame-midnight-front.webp" alt="" fill sizes="520px" className="object-contain" priority />
      </div>
      <div className="shell relative flex min-h-[70svh] flex-col justify-end">
        <p className="label">[ 404 ] — Off the rail</p>
        <h1 className="t-display t-hero mt-4">Gone.</h1>
        <p className="mt-6 max-w-md text-muted">That page slipped off its hanger and hit the floor. It may have moved, or the link may be wrong.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/shop" size="lg">
            Back to shop
          </Button>
          <Button href="/" variant="ghost" size="lg">
            Home
          </Button>
        </div>
      </div>
    </div>
    </SiteChrome>
  );
}
