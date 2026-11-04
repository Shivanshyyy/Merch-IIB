import type { Settings } from "@/config/site";
import type {
  Batch,
  BatchInput,
  Design,
  DesignImageBlob,
  DesignInput,
  DesignPatch,
  DesignStatus,
  Designer,
  DesignerDecision,
  DesignerInput,
  DesignerStatus,
  DesignerWithProfile,
  NewOrder,
  Order,
  OrderEvent,
  OrderFilter,
  OrderPatch,
  Payout,
  PayoutInput,
  PhotoBlob,
  Product,
  ProductInput,
  ProductTerms,
  Profile,
  ProfileInput,
} from "@/lib/types";

export class CodeTakenError extends Error {
  constructor() {
    super("order code already exists");
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super("a profile with this email already exists");
  }
}

export class SlugTakenError extends Error {
  constructor() {
    super("a product with this slug already exists");
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
  }
}

export interface Db {
  // catalogue (customer-facing)
  listActiveProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getPhoto(id: string): Promise<PhotoBlob | null>;
  getOpenBatch(): Promise<Batch | null>;

  // runtime settings: the stored JSON (possibly partial), merged with defaults by the caller
  getSettings(): Promise<unknown | null>;
  saveSettings(value: Settings): Promise<void>;

  // customers
  getProfile(userId: string): Promise<Profile | null>;
  createProfile(userId: string, email: string, data: ProfileInput): Promise<Profile>;
  updateProfile(userId: string, data: ProfileInput): Promise<Profile>;

  // orders (customer-facing)
  countPendingOrders(userId: string): Promise<number>;
  insertOrder(order: NewOrder): Promise<Order>;
  getOrderByCode(code: string): Promise<Order | null>;
  listOrdersByUser(userId: string): Promise<Order[]>;
  // Only succeeds while payment is still pending; returns false otherwise.
  setUtr(code: string, utr: string): Promise<boolean>;
  addEvent(orderId: string, type: string, note?: string): Promise<void>;

  // Orders holding one of the freebies-offer spots.
  countFreebies(): Promise<number>;

  // ---- admin ----
  listAllProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: ProductInput): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  // Appends to the product's photos and returns the new photo's id.
  addProductPhoto(productId: string, photo: PhotoBlob): Promise<string>;
  removeProductPhoto(productId: string, photoId: string): Promise<void>;

  listBatches(): Promise<Batch[]>;
  getBatch(id: string): Promise<Batch | null>;
  createBatch(input: BatchInput): Promise<Batch>;
  updateBatch(id: string, patch: Partial<BatchInput>): Promise<Batch>;

  searchOrders(filter: OrderFilter): Promise<{ rows: Order[]; total: number }>;
  // Every order (optionally one batch), for stats, exports and customer counts.
  listOrdersForBatch(batchId?: string): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | null>;
  // Applies the patch and writes one audit row in the same step.
  patchOrder(id: string, patch: OrderPatch, event: { type: string; note?: string }): Promise<Order>;
  listEvents(orderId: string): Promise<OrderEvent[]>;

  listProfiles(query?: string, limit?: number): Promise<Profile[]>;

  // ---- designers ----
  getDesigner(userId: string): Promise<Designer | null>;
  // Needs an existing profile; starts as "pending".
  createDesigner(userId: string, input: DesignerInput): Promise<Designer>;
  updateDesigner(userId: string, input: DesignerInput): Promise<Designer>;
  // The admin's decision: status, commission and the note the designer sees.
  decideDesigner(userId: string, decision: DesignerDecision): Promise<Designer>;
  listDesigners(status?: DesignerStatus): Promise<DesignerWithProfile[]>;

  createDesign(designerId: string, input: DesignInput): Promise<Design>;
  getDesign(id: string): Promise<Design | null>;
  listDesignsByDesigner(designerId: string): Promise<Design[]>;
  listDesigns(status?: DesignStatus): Promise<Design[]>;
  // Applies only the keys present and bumps updated_at.
  patchDesign(id: string, patch: DesignPatch): Promise<Design>;
  // Its images go with it.
  deleteDesign(id: string): Promise<void>;
  addDesignImage(designId: string, image: PhotoBlob): Promise<string>;
  removeDesignImage(designId: string, imageId: string): Promise<void>;
  getDesignImage(id: string): Promise<DesignImageBlob | null>;

  // Cost and commission live apart from Product so they never reach the shop.
  listProductTerms(): Promise<ProductTerms[]>;
  getProductTerms(productId: string): Promise<ProductTerms | null>;
  saveProductTerms(terms: ProductTerms): Promise<void>;

  // Orders with at least one item belonging to this designer, in any state. Callers must project them (no buyer data).
  listOrdersWithDesigner(designerId: string): Promise<Order[]>;
  listPayouts(designerId?: string): Promise<Payout[]>;
  createPayout(input: PayoutInput): Promise<Payout>;
  deletePayout(id: string): Promise<void>;
}
