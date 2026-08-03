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
  received: number;
  sold: number;
  damaged: number;
  available: number; // calculated: previous_available + received - sold - damaged
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
