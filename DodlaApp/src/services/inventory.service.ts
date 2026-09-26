/**
 * inventory.service.ts — Inventory transaction management.
 * Records stock movements (received, sold, damaged) and calculates daily summaries.
 *
 * Business Rules:
 * - transaction_type='received' → sale_type=NULL, customer_id=NULL
 * - transaction_type='damaged' → sale_type=NULL, customer_id=NULL
 * - transaction_type='sold' + sale_type='retail' → customer_id=NULL
 * - transaction_type='sold' + sale_type='wholesale' → customer_id REQUIRED
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult, ApiError, failure } from '@/lib/error-handler';
import type {
  InventoryTransaction,
  InventoryTransactionInsert,
  TransactionType,
  DailyProductSummary,
  DailySummary,
} from '@/types/database.types';

class InventoryService extends BaseService {
  protected readonly serviceName = 'InventoryService';

  /**
   * Record a new inventory transaction.
   * Enforces business rules for transaction_type / sale_type / customer_id.
   */
  async recordTransaction(tx: InventoryTransactionInsert): Promise<ServiceResult<InventoryTransaction>> {
    // ── Validate business rules ──
    const validation = this.validateTransaction(tx);
    if (validation) return failure<InventoryTransaction>(validation);

    // Normalize: set sale_type and customer_id to null for non-sold transactions
    const normalized: InventoryTransactionInsert = { ...tx };
    if (tx.transaction_type !== 'sold') {
      normalized.sale_type = null;
      normalized.customer_id = null;
    }

    return this.query<InventoryTransaction>(
      () => supabase
        .from('inventory_transactions')
        .insert(normalized)
        .select()
        .single(),
      'recordTransaction'
    );
  }

  /**
   * Record multiple transactions at once (batch insert).
   * Useful for daily bulk entry.
   */
  async recordBatch(transactions: InventoryTransactionInsert[]): Promise<ServiceResult<InventoryTransaction[]>> {
    // Validate all before inserting
    for (const tx of transactions) {
      const validation = this.validateTransaction(tx);
      if (validation) return failure<InventoryTransaction[]>(validation);
    }

    // Normalize
    const normalized = transactions.map(tx => {
      const n = { ...tx };
      if (tx.transaction_type !== 'sold') {
        n.sale_type = null;
        n.customer_id = null;
      }
      return n;
    });

    return this.query<InventoryTransaction[]>(
      () => supabase
        .from('inventory_transactions')
        .insert(normalized)
        .select(),
      'recordBatch'
    );
  }

  /**
   * Set the exact sold quantity for a product on a date for a given sale type/customer.
   * Deletes existing matching 'sold' transactions and inserts one with the new quantity.
   * Used for correcting mistakes. qty=0 removes the entry entirely.
   */
  async setSoldQuantity(params: {
    productId: number;
    date: string;
    saleType: 'wholesale' | 'retail';
    customerId?: string | null;
    quantity: number;
  }): Promise<ServiceResult<boolean>> {
    return this.execute<boolean>(async () => {
      // Delete existing matching transactions
      let del = supabase
        .from('inventory_transactions')
        .delete()
        .eq('product_id', params.productId)
        .eq('transaction_date', params.date)
        .eq('transaction_type', 'sold')
        .eq('sale_type', params.saleType);

      if (params.saleType === 'wholesale' && params.customerId) {
        del = del.eq('customer_id', params.customerId);
      } else {
        del = del.is('customer_id', null);
      }

      const { error: delErr } = await del;
      if (delErr) throw delErr;

      // Insert new one if quantity > 0
      if (params.quantity > 0) {
        const { error: insErr } = await supabase
          .from('inventory_transactions')
          .insert({
            product_id: params.productId,
            transaction_type: 'sold',
            quantity: params.quantity,
            transaction_date: params.date,
            sale_type: params.saleType,
            customer_id: params.saleType === 'wholesale' ? params.customerId : null,
          });
        if (insErr) throw insErr;
      }

      return true;
    }, 'setSoldQuantity');
  }

  /**
   * Set exact received/damaged quantity for a product on a date.
   */
  async setStockQuantity(params: {
    productId: number;
    date: string;
    type: 'received' | 'damaged' | 'personal';
    quantity: number;
  }): Promise<ServiceResult<boolean>> {
    return this.execute<boolean>(async () => {
      const { error: delErr } = await supabase
        .from('inventory_transactions')
        .delete()
        .eq('product_id', params.productId)
        .eq('transaction_date', params.date)
        .eq('transaction_type', params.type);
      if (delErr) throw delErr;

      if (params.quantity > 0) {
        const { error: insErr } = await supabase
          .from('inventory_transactions')
          .insert({
            product_id: params.productId,
            transaction_type: params.type,
            quantity: params.quantity,
            transaction_date: params.date,
          });
        if (insErr) throw insErr;
      }
      return true;
    }, 'setStockQuantity');
  }

  /** Delete a single transaction by ID */
  async deleteTransaction(id: number): Promise<ServiceResult<boolean>> {
    return this.execute<boolean>(async () => {
      const { error } = await supabase
        .from('inventory_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    }, 'deleteTransaction');
  }

  /** Reassign a wholesale transaction to a different customer */
  async reassignCustomer(transactionId: number, newCustomerId: string): Promise<ServiceResult<boolean>> {
    return this.execute<boolean>(async () => {
      const { error } = await supabase
        .from('inventory_transactions')
        .update({ customer_id: newCustomerId })
        .eq('id', transactionId);
      if (error) throw error;
      return true;
    }, 'reassignCustomer');
  }

  /** Get all transactions for a specific date */
  async getDailyTransactions(date: string): Promise<ServiceResult<InventoryTransaction[]>> {
    return this.query<InventoryTransaction[]>(
      () => supabase
        .from('inventory_transactions')
        .select('*')
        .eq('transaction_date', date)
        .order('created_at', { ascending: true }),
      'getDailyTransactions'
    );
  }

  /** Get transactions for a product on a specific date */
  async getProductDailyTransactions(
    productId: number,
    date: string
  ): Promise<ServiceResult<InventoryTransaction[]>> {
    return this.query<InventoryTransaction[]>(
      () => supabase
        .from('inventory_transactions')
        .select('*')
        .eq('product_id', productId)
        .eq('transaction_date', date)
        .order('created_at', { ascending: true }),
      'getProductDailyTransactions'
    );
  }

  /** Get transactions for a specific customer on a date (wholesale tracking) */
  async getCustomerDailyTransactions(
    customerId: string,
    date: string
  ): Promise<ServiceResult<InventoryTransaction[]>> {
    return this.query<InventoryTransaction[]>(
      () => supabase
        .from('inventory_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .eq('transaction_date', date)
        .order('created_at', { ascending: true }),
      'getCustomerDailyTransactions'
    );
  }

  /**
   * Get daily summary — per product for a given date, using a cumulative
   * running-ledger for availability:
   *   opening   = cumulative (received - sold) for ALL days before `date`
   *   available = opening + received(date) - sold(date)   (floored at 0)
   * Damages are NOT part of stock math.
   */
  async getDailySummary(date: string): Promise<ServiceResult<DailyProductSummary[]>> {
    // Live: cumulative running-ledger via the DB function (row-cap-safe).
    return this.execute<DailyProductSummary[]>(async () => {
      const { data, error } = await supabase.rpc('stock_summary', { as_of: date });
      if (error) throw error;

      const summary: DailyProductSummary[] = (data || []).map((r: {
        product_id: number; product_name: string; category_name: string;
        opening: number; received: number; sold_retail: number; sold_wholesale: number;
        sold: number; damaged: number; personal: number; available: number;
        revenue_retail: number; revenue_wholesale: number; cost_of_goods: number;
        damaged_loss: number; personal_cost: number; price_estimated: boolean;
        purchase_price: number; retail_price: number; wholesale_price: number;
      }) => {
        const revenueRetail = Number(r.revenue_retail) || 0;
        const revenueWholesale = Number(r.revenue_wholesale) || 0;
        return {
          product_id: r.product_id,
          product_name: r.product_name,
          category_name: r.category_name ?? 'Uncategorized',
          opening: Number(r.opening) || 0,
          received: Number(r.received) || 0,
          sold: Number(r.sold) || 0,
          sold_retail: Number(r.sold_retail) || 0,
          sold_wholesale: Number(r.sold_wholesale) || 0,
          damaged: Number(r.damaged) || 0,
          personal: Number(r.personal) || 0,
          available: Number(r.available) || 0,
          revenue_retail: revenueRetail,
          revenue_wholesale: revenueWholesale,
          revenue: revenueRetail + revenueWholesale,
          cost_of_goods: Number(r.cost_of_goods) || 0,
          damaged_loss: Number(r.damaged_loss) || 0,
          personal_cost: Number(r.personal_cost) || 0,
          price_estimated: Boolean(r.price_estimated),
          purchase_price: Number(r.purchase_price) || 0,
          retail_price: Number(r.retail_price) || 0,
          wholesale_price: Number(r.wholesale_price) || 0,
        };
      });
      return summary;
    }, 'getDailySummary');
  }

  /**
   * Calculate available stock for a product up to a given date.
   * Sum of all 'received' minus all 'sold' and 'damaged' up to and including the date.
   */
  async getAvailableStock(productId: number, upToDate: string): Promise<ServiceResult<number>> {
    return this.execute<number>(async () => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('transaction_type, quantity')
        .eq('product_id', productId)
        .lte('transaction_date', upToDate);

      if (error) throw error;

      let stock = 0;
      for (const tx of data || []) {
        const type = tx.transaction_type as TransactionType;
        if (type === 'received') stock += tx.quantity;
        else if (type === 'sold') stock -= tx.quantity;
      }

      return Math.max(0, stock);
    }, 'getAvailableStock');
  }

  /**
   * Get full daily summary with totals (revenue, cost, profit).
   *
   * Totals are summed from the price SNAPSHOTTED on each transaction row.
   * They used to be recomputed as `sold_retail * retail_price + sold_wholesale
   * * wholesale_price` against the CURRENT price list, which meant editing a
   * price silently changed the revenue and profit of every past day.
   */
  async getFullDailySummary(date: string): Promise<ServiceResult<DailySummary>> {
    return this.execute<DailySummary>(async () => {
      const summaryResult = await this.getDailySummary(date);
      if (summaryResult.error) throw summaryResult.error;

      const products = summaryResult.data!;

      let totalRevenue = 0;
      let totalCost = 0;
      let totalDamagedLoss = 0;
      let totalPersonalCost = 0;
      let priceEstimated = false;

      for (const p of products) {
        totalRevenue += p.revenue;
        totalCost += p.cost_of_goods;
        totalDamagedLoss += p.damaged_loss;
        totalPersonalCost += p.personal_cost;
        if (p.price_estimated) priceEstimated = true;
      }

      return {
        date,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        total_profit: totalRevenue - totalCost,
        total_damaged_loss: totalDamagedLoss,
        total_personal_cost: totalPersonalCost,
        price_estimated: priceEstimated,
        products,
      };
    }, 'getFullDailySummary');
  }

  // ── Private helpers ──

  private validateTransaction(tx: InventoryTransactionInsert): ApiError | null {
    if (tx.quantity <= 0) {
      return new ApiError('Quantity must be greater than 0', 'VALIDATION_ERROR');
    }

    if (tx.transaction_type === 'sold') {
      if (tx.sale_type === 'wholesale' && !tx.customer_id) {
        return new ApiError(
          'Customer ID is required for wholesale sales',
          'VALIDATION_ERROR'
        );
      }
    }

    return null;
  }
}

export const inventoryService = new InventoryService();
