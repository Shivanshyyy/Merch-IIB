"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { addDesignImage, removeDesignImage } from "@/actions/designs";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { shrinkImage } from "@/lib/admin/shrink-image";
import { designImageUrl } from "@/lib/photos";
import { MAX_IMAGES } from "@/lib/designer/design-flow";

// The images the team reviews. The first is the cover. Editable only while the design is still the designer's to change.
export function DesignImages({ designId, images, editable }: { designId: string; images: string[]; editable: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const room = MAX_IMAGES - images.length;

  const upload = (files: File[]) =>
    start(async () => {
      let added = 0;
      for (const [i, file] of files.slice(0, room).entries()) {
        setProgress(`Uploading ${i + 1} of ${Math.min(files.length, room)}…`);
        const body = new FormData();
        body.set("image", await shrinkImage(file));
        const result = await addDesignImage(designId, body);
        if (!result.ok) {
          toast({ message: `${file.name}: ${result.message}` });
          break;
        }
        added++;
      }
      setProgress("");
      if (files.length > room) toast({ message: `Only ${MAX_IMAGES} images fit; the rest were skipped.` });
      else if (added) toast({ message: added === 1 ? "Image added." : `${added} images added.` });
    });

  const remove = (imageId: string) =>
    start(async () => {
      toast({ message: (await removeDesignImage(designId, imageId)).message });
    });

  return (
    <section aria-labelledby="images-h" className="grid gap-4">
      <div>
        <h2 id="images-h" className="label text-fg">
          [ Images ]
        </h2>
        <p className="mt-2 max-w-xl text-[0.95rem] text-muted">Show the artwork on the garment, or flat on its own. The first image is the cover. Only you and the team can see them until a design goes live.</p>
      </div>

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((id, i) => (
            <li key={id} className="grid gap-2">
              <div className="relative aspect-[4/5] overflow-hidden border border-line bg-bg-2">
                {/* Unoptimised: the image optimiser can't send the login cookie these private images need. */}
                <Image src={designImageUrl(id)} alt={`Design image ${i + 1}${i === 0 ? " (cover)" : ""}`} fill unoptimized sizes="(min-width: 768px) 160px, 45vw" className="object-cover" />
                {i === 0 && <span className="label absolute left-2 top-2 border border-line bg-bg/80 px-2 py-1">Cover</span>}
              </div>
              {editable && (
                <ConfirmButton disabled={pending} onConfirm={() => remove(id)} confirmLabel="Tap again to remove">
                  Remove
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border border-dashed border-line p-6 text-center text-muted">No images yet.</p>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            data-testid="design-image-input"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = ""; // so picking the same file again still fires
              if (files.length) upload(files);
            }}
          />
          <Button variant="ghost" loading={pending} disabled={room <= 0} onClick={() => input.current?.click()}>
            {room <= 0 ? "Image limit reached" : "Add images"}
          </Button>
          <span role="status" className="label">
            {progress || `${images.length} of ${MAX_IMAGES}`}
          </span>
        </div>
      )}
    </section>
  );
}
