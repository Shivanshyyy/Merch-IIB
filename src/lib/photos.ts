// Safe for the browser: the limits and the address of an uploaded photo. The image processing is in photo-process.ts.
export const MAX_PHOTOS_PER_PRODUCT = 8;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel rejects request bodies over 4.5 MB

export const photoUrl = (id: string) => `/photos/${id}`;

// Design images are private: a designer loads their own from here, the admin from the /admin copy (the admin cookie only reaches /admin).
export const designImageUrl = (id: string) => `/design-images/${id}`;
export const adminDesignImageUrl = (id: string) => `/admin/design-images/${id}`;
