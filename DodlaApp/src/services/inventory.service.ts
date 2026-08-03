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
   * Get daily summary — aggregated totals per product for a given date.
   * Returns received, sold, damaged totals per product.
   */
  async getDailySummary(date: string): Promise<ServiceResult<DailyProductSummary[]>> {
    return this.execute<DailyProductSummary[]>(async () => {
      // Fetch all transactions for the date
      const { data: transactions, error: txError } = await supabase
        .from('inventory_transactions')
        .select('product_id, transaction_type, quantity')
        .eq('transaction_date', date);

      if (txError) throw txError;

      // Fetch all active products with prices and category
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, product_name, purchase_price, retail_price, wholesale_price, category_id, categories ( name )')
        .eq('active', true)
        .order('category_id')
        .order('product_name');

      if (prodError) throw prodError;

      // Aggregate transactions per product
      const txMap = new Map<number, { received: number; sold: number; damaged: number }>();
      for (const tx of transactions || []) {
        if (!tx.product_id) continue;
        if (!txMap.has(tx.product_id)) {
          txMap.set(tx.product_id, { received: 0, sold: 0, damaged: 0 });
        }
        const entry = txMap.get(tx.product_id)!;
        const type = tx.transaction_type as TransactionType;
        entry[type] += tx.quantity;
      }

      // Build summary
      const summary: DailyProductSummary[] = (products || []).map(p => {
        const agg = txMap.get(p.id) || { received: 0, sold: 0, damaged: 0 };
        return {
          product_id: p.id,
          product_name: p.product_name,
          category_name: (p.categories as unknown as { name: string })?.name ?? 'Uncategorized',
          received: agg.received,
          sold: agg.sold,
          damaged: agg.damaged,
          available: agg.received - agg.sold - agg.damaged, // simplified; real app may carry forward
          purchase_price: p.purchase_price ?? 0,
          retail_price: p.retail_price ?? 0,
          wholesale_price: p.wholesale_price ?? 0,
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
        else if (type === 'sold' || type === 'damaged') stock -= tx.quantity;
      }

      return Math.max(0, stock);
    }, 'getAvailableStock');
  }

  /**
   * Get full daily summary with totals (revenue, cost, profit).
   */
  async getFullDailySummary(date: string): Promise<ServiceResult<DailySummary>> {
    return this.execute<DailySummary>(async () => {
      const summaryResult = await this.getDailySummary(date);
      if (summaryResult.error) throw summaryResult.error;

      const products = summaryResult.data!;

      let totalRevenue = 0;
      let totalCost = 0;
      let totalDamagedLoss = 0;

      for (const p of products) {
        // Revenue: sold qty × retail price (simplified — wholesale tracked separately)
        totalRevenue += p.sold * p.retail_price;
        // Cost: sold qty × purchase price
        totalCost += p.sold * p.purchase_price;
        // Damaged loss: damaged qty × purchase price
        totalDamagedLoss += p.damaged * p.purchase_price;
      }

      return {
        date,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        total_profit: totalRevenue - totalCost,
        total_damaged_loss: totalDamagedLoss,
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
