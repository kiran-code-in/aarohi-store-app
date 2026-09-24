/**
 * price.service.ts — Price management: current prices, updates, and history.
 * Prices live on the products table (current) and product_prices table (history).
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult, success } from '@/lib/error-handler';
import { isDemoMode, DEMO_PRODUCTS } from '@/lib/demo-data';
import type { Product, ProductPrice } from '@/types/database.types';

export interface ProductPriceInfo {
  product_id: number;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
}

class PriceService extends BaseService {
  protected readonly serviceName = 'PriceService';

  /** Get current prices for a product (from products table) */
  async getCurrentPrices(productId: number): Promise<ServiceResult<ProductPriceInfo>> {
    return this.query<ProductPriceInfo>(
      () => supabase
        .from('products')
        .select('id, purchase_price, retail_price, wholesale_price')
        .eq('id', productId)
        .single()
        .then(({ data, error }) => ({
          data: data ? {
            product_id: data.id,
            purchase_price: data.purchase_price ?? 0,
            retail_price: data.retail_price ?? 0,
            wholesale_price: data.wholesale_price ?? 0,
          } : null,
          error,
        })),
      'getCurrentPrices'
    );
  }

  /** Get current prices for ALL active products (batch) */
  async getAllCurrentPrices(): Promise<ServiceResult<ProductPriceInfo[]>> {
    if (isDemoMode()) {
      return success(DEMO_PRODUCTS.map(p => ({
        product_id: p.id,
        purchase_price: p.purchase_price ?? 0,
        retail_price: p.retail_price ?? 0,
        wholesale_price: p.wholesale_price ?? 0,
      })));
    }
    return this.query<ProductPriceInfo[]>(
      () => supabase
        .from('products')
        .select('id, purchase_price, retail_price, wholesale_price')
        .eq('active', true)
        .then(({ data, error }) => ({
          data: data?.map(p => ({
            product_id: p.id,
            purchase_price: p.purchase_price ?? 0,
            retail_price: p.retail_price ?? 0,
            wholesale_price: p.wholesale_price ?? 0,
          })) ?? null,
          error,
        })),
      'getAllCurrentPrices'
    );
  }

  /**
   * Update a product's price.
   *
   * History is recorded by the `trg_record_price_change` DB trigger
   * (supabase-price-snapshot.sql), in the same transaction as the price change.
   * This used to be an un-awaited client-side insert that only console.warn'd
   * on failure, so history could silently diverge from the real prices — which
   * is why sales before price history existed can no longer be priced exactly.
   *
   * Changing a price only affects FUTURE transactions. Past sales keep the
   * price snapshotted on their inventory_transactions row.
   */
  async updatePrice(
    productId: number,
    prices: {
      purchase_price?: number;
      retail_price?: number;
      wholesale_price?: number;
    }
  ): Promise<ServiceResult<Product>> {
    // Build update object (only include provided fields)
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (prices.purchase_price !== undefined) updateFields.purchase_price = prices.purchase_price;
    if (prices.retail_price !== undefined) updateFields.retail_price = prices.retail_price;
    if (prices.wholesale_price !== undefined) updateFields.wholesale_price = prices.wholesale_price;

    // Update current price on products table
    const result = await this.query<Product>(
      () => supabase
        .from('products')
        .update(updateFields)
        .eq('id', productId)
        .select()
        .single(),
      'updatePrice'
    );

    // No history insert here — trg_record_price_change handles it atomically.
    return result;
  }

  /** Get price change history for a product, newest first */
  async getPriceHistory(productId: number, limit = 30): Promise<ServiceResult<ProductPrice[]>> {
    return this.query<ProductPrice[]>(
      () => supabase
        .from('product_prices')
        .select('*')
        .eq('product_id', productId)
        .order('effective_date', { ascending: false })
        .limit(limit),
      'getPriceHistory'
    );
  }

  /** Get ALL price history (across all products), newest first */
  async getAllPriceHistory(limit = 50): Promise<ServiceResult<ProductPrice[]>> {
    if (isDemoMode()) return success([]);
    return this.query<ProductPrice[]>(
      () => supabase
        .from('product_prices')
        .select('*')
        .order('effective_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit),
      'getAllPriceHistory'
    );
  }
}

export const priceService = new PriceService();
