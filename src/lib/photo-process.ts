import "server-only";
import sharp from "sharp";
import type { PhotoBlob } from "@/lib/types";

const LONG_EDGE = 1600;

export class BadPhotoError extends Error {}

const unreadable = () => new BadPhotoError("That file isn't a photo we can read. Use a JPG, PNG or WebP picture.");

// Whatever the admin uploads is decoded, turned upright, shrunk and re-encoded as WebP. Re-encoding also drops EXIF
// (including GPS) and means only real image data is ever stored or served, whatever the file claimed to be.
export async function normalizePhoto(input: Buffer): Promise<PhotoBlob> {
  try {
    const image = sharp(input, { limitInputPixels: 60_000_000 });
    const { format } = await image.metadata();
    if (format !== "jpeg" && format !== "png" && format !== "webp") throw unreadable();
    const bytes = await image.rotate().resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return { mime: "image/webp", bytes };
  } catch (e) {
    throw e instanceof BadPhotoError ? e : unreadable();
  }
}
