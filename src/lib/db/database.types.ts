// Hand-written schema for supabase-js, so wrong column names or filters fail at compile time.
// Keep in sync with supabase/migrations/*.sql.
import type { Settings } from "@/config/site";
import type { Batch, NewOrder, Order, OrderEvent, Product, Profile } from "@/lib/types";

type Table<Row, Insert = Row, Update = Partial<Row>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

type ProductRow = Omit<Product, "photos"> & { created_at: string };
type ProductPhotoRow = { id: string; product_id: string; mime: string; data: string; created_at: string };
type ProfileRow = Profile;

export type Database = {
  public: {
    Tables: {
      products: Table<ProductRow, Omit<Product, "id" | "photos"> & { id?: string }>;
      product_photos: Table<ProductPhotoRow, { product_id: string; mime: string; data: string }>;
      batches: Table<Batch, Omit<Batch, "id"> & { id?: string }>;
      orders: Table<Order, NewOrder>;
      order_events: Table<OrderEvent, { order_id: string; type: string; note?: string | null }>;
      profiles: Table<ProfileRow, Omit<ProfileRow, "created_at">>;
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
