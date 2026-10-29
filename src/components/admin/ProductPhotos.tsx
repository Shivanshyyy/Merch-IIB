"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { addProductPhoto, removeProductPhoto } from "@/actions/admin/products";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { shrinkImage } from "@/lib/admin/shrink-image";
import { MAX_PHOTOS_PER_PRODUCT, photoUrl } from "@/lib/photos";

// The pictures on the shop cards. The first photo is the cover; the second, if there is one, appears when a card is hovered.
export function ProductPhotos({ productId, photos }: { productId: string; photos: string[] }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const room = MAX_PHOTOS_PER_PRODUCT - photos.length;

  const upload = (files: File[]) =>
    start(async () => {
      let added = 0;
      for (const [i, file] of files.slice(0, room).entries()) {
        setProgress(`Uploading ${i + 1} of ${Math.min(files.length, room)}…`);
        const body = new FormData();
        body.set("photo", await shrinkImage(file));
        const result = await addProductPhoto(productId, body);
        if (!result.ok) {
          toast({ message: `${file.name}: ${result.message}` });
          break;
        }
        added++;
      }
      setProgress("");
      if (files.length > room) toast({ message: `Only ${MAX_PHOTOS_PER_PRODUCT} photos fit; the rest were skipped.` });
      else if (added) toast({ message: added === 1 ? "Photo added." : `${added} photos added.` });
    });

  const remove = (photoId: string) =>
    start(async () => {
      toast({ message: (await removeProductPhoto(productId, photoId)).message });
    });

  return (
    <section aria-labelledby="photos-h" className="grid gap-4 border-t border-line pt-8">
      <div>
        <h2 id="photos-h" className="t-display text-2xl">
          Photos
        </h2>
        <p className="admin-label mt-2">
          Shown on the shop cards instead of the 3D model. The first photo is the cover, and the second appears when someone hovers the card. With no photos, the card shows the studio picture.
        </p>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((id, i) => (
            <li key={id} className="grid gap-2">
              <div className="relative aspect-[4/5] overflow-hidden border border-line bg-bg-2">
                <Image src={photoUrl(id)} alt={`Photo ${i + 1}${i === 0 ? " (cover)" : ""}`} fill sizes="(min-width: 768px) 160px, 45vw" className="object-cover" />
                {i === 0 && <span className="label absolute left-2 top-2 border border-line bg-bg/80 px-2 py-1">Cover</span>}
              </div>
              <ConfirmButton disabled={pending} onConfirm={() => remove(id)} confirmLabel="Tap again to remove">
                Remove
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = ""; // so picking the same file again still fires
            if (files.length) upload(files);
          }}
        />
        <Button variant="quiet" className="btn-sm" loading={pending} disabled={room <= 0} onClick={() => input.current?.click()}>
          {room <= 0 ? "Photo limit reached" : "Add photos"}
        </Button>
        <span role="status" className="admin-label">
          {progress || `${photos.length} of ${MAX_PHOTOS_PER_PRODUCT}`}
        </span>
      </div>
    </section>
  );
}
