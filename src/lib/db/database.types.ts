// Hand-written schema for supabase-js, so wrong column names or filters fail at compile time.
// Keep in sync with supabase/migrations/*.sql.
import type { Settings } from "@/config/site";
import type { Batch, Design, Designer, NewOrder, Order, OrderEvent, Payout, Product, ProductTerms, Profile } from "@/lib/types";

type Table<Row, Insert = Row, Update = Partial<Row>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

type ProductRow = Omit<Product, "photos"> & { created_at: string };
type ProductPhotoRow = { id: string; product_id: string; mime: string; data: string; created_at: string };
type ProfileRow = Profile;
type DesignRow = Omit<Design, "images">;
type DesignInsert = Pick<Design, "designer_id" | "title" | "product_type"> & Partial<Omit<DesignRow, "id" | "created_at" | "updated_at">>;
type DesignImageRow = { id: string; design_id: string; mime: string; data: string; created_at: string };
// The two cost columns come from migration 0008, so a row read before it was run may lack them.
type TermsRow = Omit<ProductTerms, "vendor_cost_inr" | "packaging_cost_inr"> & { vendor_cost_inr?: number | null; packaging_cost_inr?: number | null; updated_at: string };

export type Database = {
  public: {
    Tables: {
      products: Table<ProductRow, Omit<Product, "id" | "photos"> & { id?: string }>;
      product_photos: Table<ProductPhotoRow, { product_id: string; mime: string; data: string }>;
      batches: Table<Batch, Omit<Batch, "id"> & { id?: string }>;
      orders: Table<Order, NewOrder>;
      order_events: Table<OrderEvent, { order_id: string; type: string; note?: string | null }>;
      profiles: Table<ProfileRow, Omit<ProfileRow, "created_at">>;
      designers: Table<Designer, Pick<Designer, "id"> & Partial<Omit<Designer, "id" | "created_at">>>;
      designs: Table<DesignRow, DesignInsert>;
      design_images: Table<DesignImageRow, { design_id: string; mime: string; data: string }>;
      product_terms: Table<TermsRow, ProductTerms & { updated_at?: string }>;
      designer_payouts: Table<Payout, Pick<Payout, "designer_id" | "amount_inr"> & Partial<Pick<Payout, "reference" | "note">>>;
      settings: Table<{ id: number; value: Settings | Record<string, unknown>; updated_at: string }, { id: number; value: Settings | Record<string, unknown> }>;
    };
    Views: Record<string, never>;
    Functions: {
      admin_patch_order: {
        Args: { p_id: string; p_patch: Record<string, unknown>; p_event_type: string; p_event_note?: string };
        Returns: Order;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
