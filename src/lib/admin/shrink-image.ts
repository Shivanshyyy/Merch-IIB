// Phone photos are 3-8 MB. Shrinking them here keeps an upload under the 4 MB request limit and quick on hostel Wi-Fi.
// The server decodes and re-encodes every upload anyway, so this is only about size; any failure sends the original.
const toBlob = (canvas: HTMLCanvasElement, type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));

export async function shrinkImage(file: File, longEdge = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob = await toBlob(canvas, "image/webp");
    if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg"); // older Safari can't encode WebP
    if (blob && blob.size < file.size) return new File([blob], blob.type === "image/webp" ? "photo.webp" : "photo.jpg", { type: blob.type });
  } catch {
    // the browser can't decode this file: the server will say whether it's usable
  }
  return file;
}
