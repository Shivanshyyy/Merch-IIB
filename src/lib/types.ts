export type Colorway = { name: string; body: string; stitch: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  type: "hoodie" | "tee";
  description: string;
  price_inr: number;
  colorways: Colorway[];
  sizes: string[];
  personalizable: boolean;
  active: boolean;
  sort: number;
  /** Ids of the admin-uploaded photos, in display order; the first is the cover. Served from /photos/<id>. */
  photos: string[];
};
export type ProductInput = Omit<Product, "id" | "photos">;

/** An uploaded photo as stored: always WebP, already resized. */
export type PhotoBlob = { mime: string; bytes: Buffer };

export type BatchStatus = "open" | "closed" | "ordered" | "received" | "done";

export type Batch = {
  id: string;
  name: string;
  opens_at: string;
  closes_at: string;
  est_delivery: string;
  status: BatchStatus;
};
export type BatchInput = Omit<Batch, "id">;

// Snapshot stored on the order; prices come from the DB at order time, never from the client.
export type OrderItem = {
  slug: string;
  productName: string;
  colorway: string;
  size: string;
  name: string;
  qty: number;
  unitPriceInr: number;
};

export type PaymentStatus = "pending" | "verified" | "rejected";
export type OrderStatus = "placed" | "in_production" | "ready" | "collected" | "cancelled";
export type RefundStatus = "none" | "requested" | "approved" | "refunded";

export type Order = {
  id: string;
  code: string;
  batch_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  phone: string;
  hostel: string;
  room: string;
  items: OrderItem[];
  total_inr: number;
  utr: string | null;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  refund_status: RefundStatus;
  admin_note: string | null;
  verified_at: string | null;
  created_at: string;
};

export type NewOrder = Pick<Order, "code" | "batch_id" | "user_id" | "email" | "full_name" | "phone" | "hostel" | "room" | "items" | "total_inr">;

export type OrderEvent = { id: number; order_id: string; type: string; note: string | null; created_at: string };

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  roll_no: string | null;
  default_size: string | null;
  created_at: string;
};
export type ProfileInput = Pick<Profile, "full_name" | "phone" | "roll_no" | "default_size">;

// Columns an admin action may change on an order (applied atomically with its audit row).
export type OrderPatch = Partial<Pick<Order, "payment_status" | "order_status" | "refund_status" | "admin_note" | "utr" | "verified_at" | "items">>;

export type OrderFilter = {
  q?: string;
  payment?: PaymentStatus;
  status?: OrderStatus;
  refund?: RefundStatus | "open";
  batchId?: string;
  sort?: "new" | "old";
  limit: number;
  offset: number;
};
