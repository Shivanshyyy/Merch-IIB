import { Button } from "@/components/ui/Button";
import { whatsappUrl, type Settings } from "@/config/site";
import { DESIGNER_STATUS_LABEL } from "@/lib/designer/design-flow";
import type { Designer } from "@/lib/types";

const COPY = {
  pending: { title: "Application received", body: "We review applications by hand. Once you're approved you can upload designs and your dashboard unlocks. There's nothing else to do right now." },
  rejected: { title: "We couldn't approve your application", body: "This time it wasn't a fit. If you think that's a mistake, or want to apply again with more to show, message us." },
  suspended: { title: "Your designer account is paused", body: "You can't upload new designs while it's paused. Message us to sort it out." },
} as const;

// What a designer sees until they're approved (or after they're paused).
export function StatusPanel({ designer, settings }: { designer: Designer; settings: Settings }) {
  const status = designer.status === "approved" ? "pending" : designer.status;
  const copy = COPY[status];
  return (
    <section aria-labelledby="status-h" className="max-w-xl">
      <p className="label">[ {DESIGNER_STATUS_LABEL[designer.status]} ]</p>
      <h1 id="status-h" className="t-display t-h2 mt-3">
        {copy.title}
      </h1>
      <p className="mt-6 text-muted">{copy.body}</p>
      {designer.decision_note && (
        <blockquote className="mt-6 border-l-2 border-fg pl-4">
          <p className="label mb-1">Note from the team</p>
          <p>{designer.decision_note}</p>
        </blockquote>
      )}
      <div className="mt-8">
        <Button href={whatsappUrl(settings.whatsapp, "Hi, I have a question about my designer account.")} variant="ghost" target="_blank" rel="noopener">
          Message {settings.contactName} on WhatsApp
        </Button>
      </div>
    </section>
  );
}
