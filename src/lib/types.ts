export type Colorway = { name: string; body: string; stitch: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  type: "hoodie" | "tee";
  description: string;
  price_inr: number;
  /** Original price shown crossed out when it is higher than price_inr; null means no discount. */
  compare_at_inr: number | null;
  /** Added to the unit price when a name is printed (e.g. ₹99 on tees); 0 means free. */
  name_fee_inr: number;
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
  /** Includes the name-print fee, if any. */
  unitPriceInr: number;
  nameFeeInr?: number;
  /** Designer share, locked when the order was placed. Never shown to buyers. */
  designer?: { id: string; costInr: number; pct: number; unitCommissionInr: number };
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
  /** Cart offer taken off the item subtotal (total_inr is after it). */
  discount_inr: number;
  discount_label: string | null;
  utr: string | null;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  refund_status: RefundStatus;
  admin_note: string | null;
  verified_at: string | null;
  /** One of the first N paid orders in the freebies offer. */
  freebie: boolean;
  created_at: string;
};

export type NewOrder = Pick<Order, "code" | "batch_id" | "user_id" | "email" | "full_name" | "phone" | "hostel" | "room" | "items" | "total_inr" | "discount_inr" | "discount_label">;

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
export type OrderPatch = Partial<Pick<Order, "payment_status" | "order_status" | "refund_status" | "admin_note" | "utr" | "verified_at" | "items" | "freebie">>;

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

// ---- designers ----

export type DesignerStatus = "pending" | "approved" | "rejected" | "suspended";

export type Designer = {
  /** Same id as the auth user and the customer profile. */
  id: string;
  bio: string | null;
  /** Where payouts are sent. */
  upi_id: string | null;
  status: DesignerStatus;
  /** Whole percent of profit, set by the admin on approval. */
  commission_pct: number | null;
  /** The admin's note, shown to the designer. */
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};
export type DesignerInput = Pick<Designer, "bio" | "upi_id">;
export type DesignerDecision = Pick<Designer, "status" | "commission_pct" | "decision_note">;
export type DesignerWithProfile = Designer & Pick<Profile, "full_name" | "email" | "phone">;

export type DesignStatus = "draft" | "in_review" | "changes_requested" | "approved" | "rejected" | "live" | "retired";

export type Design = {
  id: string;
  designer_id: string;
  title: string;
  description: string;
  product_type: Product["type"];
  /** Garment colours the designer proposes; the admin can change them when publishing. */
  colorways: Colorway[];
  suggested_price_inr: number | null;
  /** Optional link to a print-ready file (Drive, Dropbox...). */
  print_file_url: string | null;
  originality_confirmed_at: string | null;
  status: DesignStatus;
  /** The admin's latest feedback, shown to the designer. */
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  /** Set when the design is published as a shop product. */
  product_id: string | null;
  /** Ids of the uploaded images, in display order; the first is the cover. Served from /design-images/<id>. */
  images: string[];
  created_at: string;
  updated_at: string;
};
export type DesignInput = Pick<Design, "title" | "description" | "product_type" | "colorways" | "suggested_price_inr" | "print_file_url">;
export type DesignPatch = Partial<DesignInput & Pick<Design, "status" | "review_note" | "submitted_at" | "reviewed_at" | "originality_confirmed_at" | "product_id">>;

/** An uploaded design image, with its owner so the route can check access. */
export type DesignImageBlob = PhotoBlob & { designId: string };

/** What a product costs to make and who designed it. Kept apart from Product so it never reaches the shop. */
export type ProductTerms = {
  product_id: string;
  designer_id: string | null;
  design_id: string | null;
  /** Production cost per unit, in whole rupees. */
  cost_inr: number;
  /** Whole-percent override for this product; null means the designer's own rate applies. */
  commission_pct: number | null;
};

export type Payout = {
  id: string;
  designer_id: string;
  amount_inr: number;
  /** UTR or note of the transfer. */
  reference: string | null;
  note: string | null;
  paid_at: string;
};
export type PayoutInput = Pick<Payout, "designer_id" | "amount_inr" | "reference" | "note">;
