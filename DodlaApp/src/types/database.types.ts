/**
 * database.types.ts — TypeScript types matching Supabase schema exactly.
 * Generated from: categories, products, product_prices, customers, inventory_transactions
 */

// ═══════════════════════════════════════════════════════════════
//  ENUMS
// ═══════════════════════════════════════════════════════════════

export type TransactionType = 'received' | 'sold' | 'damaged';

export type SaleType = 'wholesale' | 'retail' | null;

export type CustomerType = 'wholesale' | 'retail' | 'both' | null;

export type TrackingMode = 'daily' | 'weekly' | 'monthly' | null;

export type ProductType = 'milk' | 'ice_cream' | 'soft_drink' | 'ready_to_cook' | null;

// ═══════════════════════════════════════════════════════════════
//  TABLE ROW TYPES (matches DB columns exactly)
// ═══════════════════════════════════════════════════════════════

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  category_id: number | null;
  product_type: string | null;
  product_name: string;
  purchase_price: number | null;
  retail_price: number | null;
  wholesale_price: number | null;
  min_stock: number | null;
  tracking_mode: TrackingMode;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductPrice {
  id: number;
  product_id: number | null;
  purchase_price: number | null;
  retail_price: number | null;
  wholesale_price: number | null;
  effective_date: string | null;
  created_at: string | null;
}

export interface Customer {
  id: string; // uuid
  name: string;
  phone: string | null;
  address: string | null;
  customer_type: CustomerType;
  created_at: string | null;
}

export interface InventoryTransaction {
  id: number;
  product_id: number | null;
  transaction_type: TransactionType | null;
  quantity: number;
  remarks: string | null;
  transaction_date: string | null;
  created_at: string | null;
  sale_type: SaleType;
  customer_id: string | null; // uuid FK to customers
}

export type NoteType = 'payment' | 'balance' | 'note';

export interface CustomerNote {
  id: number;
  customer_id: string;
  note_type: NoteType;
  amount: number | null;
  note: string | null;
  note_date: string | null;
  created_at: string | null;
}

// ═══════════════════════════════════════════════════════════════
//  INSERT TYPES (for creating new records — omit auto-generated fields)
// ═══════════════════════════════════════════════════════════════

export interface CategoryInsert {
  name: string;
}

export interface ProductInsert {
  category_id: number;
  product_type?: string | null;
  product_name: string;
  purchase_price?: number | null;
  retail_price?: number | null;
  wholesale_price?: number | null;
  min_stock?: number | null;
  tracking_mode?: TrackingMode;
  active?: boolean;
}

export interface ProductPriceInsert {
  product_id: number;
  purchase_price?: number | null;
  retail_price?: number | null;
  wholesale_price?: number | null;
  effective_date: string; // 'YYYY-MM-DD'
}

export interface CustomerInsert {
  name: string;
  phone?: string | null;
  address?: string | null;
  customer_type?: CustomerType;
}

export interface InventoryTransactionInsert {
  product_id: number;
  transaction_type: TransactionType;
  quantity: number;
  remarks?: string | null;
  transaction_date: string; // 'YYYY-MM-DD'
  sale_type?: SaleType;
  customer_id?: string | null;
}

export interface CustomerNoteInsert {
  customer_id: string;
  note_type: NoteType;
  amount?: number;
  note?: string | null;
  note_date?: string; // 'YYYY-MM-DD'
}

/** Customer with computed balance for ledger view */
export interface CustomerBalance {
  customer_id: string;
  customer_name: string;
  total_purchases: number;   // sum of all wholesale sales
  total_paid: number;        // sum of payments
  balance: number;           // purchases - paid
}

// ═══════════════════════════════════════════════════════════════
//  UPDATE TYPES (partial updates)
// ═══════════════════════════════════════════════════════════════

export interface ProductUpdate {
  product_name?: string;
  category_id?: number;
  product_type?: string | null;
  purchase_price?: number | null;
  retail_price?: number | null;
  wholesale_price?: number | null;
  min_stock?: number | null;
  tracking_mode?: TrackingMode;
  active?: boolean;
}

export interface CustomerUpdate {
  name?: string;
  phone?: string | null;
  address?: string | null;
  customer_type?: CustomerType;
}

// ═══════════════════════════════════════════════════════════════
//  JOINED / ENRICHED TYPES (for UI consumption)
// ═══════════════════════════════════════════════════════════════

/** Product with its category name resolved */
export interface ProductWithCategory extends Product {
  category_name: string;
}

/** Daily inventory summary per product */
export interface DailyProductSummary {
  product_id: number;
  product_name: string;
  category_name: string;
  pending: number;  // opening balance carried from prior days (SUM received - sold - damaged where date < today, floored at 0)
  received: number;
  sold: number;
  damaged: number;
  available: number; // calculated: pending + received - sold - damaged
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
}

/** Daily totals across all products */
export interface DailySummary {
  date: string;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_damaged_loss: number;
  products: DailyProductSummary[];
}

/** Customer sale record for a day */
export interface CustomerDailySale {
  customer_id: string;
  customer_name: string;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  grand_total: number;
}

// ═══════════════════════════════════════════════════════════════
//  ADVANCE ORDERS (pre-orders / bookings)
// ═══════════════════════════════════════════════════════════════

export type AdvanceStatus = 'pending' | 'delivered' | 'cancelled';

export interface AdvanceOrder {
  id: number;
  customer_id: string;
  order_date: string;       // 'YYYY-MM-DD'
  requested_date: string;   // 'YYYY-MM-DD'
  advance_amount: number;
  paid_full: boolean;
  status: AdvanceStatus;
  note: string | null;
  delivered_date: string | null;
  created_at: string | null;
}

export interface AdvanceOrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
}

export interface AdvanceOrderInsert {
  customer_id: string;
  order_date?: string;
  requested_date: string;
  advance_amount: number;
  paid_full?: boolean;
  note?: string | null;
}

export interface AdvanceOrderItemInsert {
  order_id: number;
  product_id: number;
  quantity: number;
}

/** Advance order enriched with customer name + resolved item details, for UI. */
export interface AdvanceOrderView extends AdvanceOrder {
  customer_name: string;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    wholesale_price: number;
  }>;
  order_total: number; // sum of item qty × wholesale_price
}

/** Aggregate quantity needed per product across all pending advance orders. */
export interface AdvanceItemRollup {
  product_id: number;
  product_name: string;
  total_quantity: number;
}
