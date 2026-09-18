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
import { ServiceResult, ApiError, failure, success } from '@/lib/error-handler';
import {
  isDemoMode, DEMO_PRODUCTS, DEMO_CATEGORIES,
  loadDemoTxns, saveDemoTxns, nextTxId,
} from '@/lib/demo-data';
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

    if (isDemoMode()) {
      const txns = loadDemoTxns();
      const newTx: InventoryTransaction = {
        id: nextTxId(),
        product_id: tx.product_id,
        transaction_type: tx.transaction_type,
        quantity: tx.quantity,
        remarks: tx.remarks ?? null,
        transaction_date: tx.transaction_date,
        created_at: new Date().toISOString(),
        sale_type: tx.transaction_type === 'sold' ? (tx.sale_type ?? null) : null,
        customer_id: tx.transaction_type === 'sold' ? (tx.customer_id ?? null) : null,
      };
      txns.push(newTx);
      saveDemoTxns(txns);
      return success(newTx);
    }

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
    if (isDemoMode()) {
      let txns = loadDemoTxns();
      // Remove matching sold entries
      txns = txns.filter(t => !(
        t.product_id === params.productId &&
        t.transaction_date === params.date &&
        t.transaction_type === 'sold' &&
        t.sale_type === params.saleType &&
        (params.saleType === 'wholesale' ? t.customer_id === params.customerId : !t.customer_id)
      ));
      if (params.quantity > 0) {
        txns.push({
          id: nextTxId(), product_id: params.productId, transaction_type: 'sold',
          quantity: params.quantity, remarks: null, transaction_date: params.date,
          created_at: new Date().toISOString(), sale_type: params.saleType,
          customer_id: params.saleType === 'wholesale' ? (params.customerId ?? null) : null,
        });
      }
      saveDemoTxns(txns);
      return success(true);
    }
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
    type: 'received' | 'damaged';
    quantity: number;
  }): Promise<ServiceResult<boolean>> {
    if (isDemoMode()) {
      let txns = loadDemoTxns();
      txns = txns.filter(t => !(
        t.product_id === params.productId &&
        t.transaction_date === params.date &&
        t.transaction_type === params.type
      ));
      if (params.quantity > 0) {
        txns.push({
          id: nextTxId(), product_id: params.productId, transaction_type: params.type,
          quantity: params.quantity, remarks: null, transaction_date: params.date,
          created_at: new Date().toISOString(), sale_type: null, customer_id: null,
        });
      }
      saveDemoTxns(txns);
      return success(true);
    }
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
    if (isDemoMode()) {
      return success(loadDemoTxns().filter(t => t.transaction_date === date));
    }
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
    if (isDemoMode()) {
      const all = loadDemoTxns();
      const txns = all.filter(t => t.transaction_date === date);
      const txMap = new Map<number, { received: number; sold: number; sold_retail: number; sold_wholesale: number; damaged: number }>();
      for (const t of txns) {
        if (!t.product_id) continue;
        if (!txMap.has(t.product_id)) txMap.set(t.product_id, { received: 0, sold: 0, sold_retail: 0, sold_wholesale: 0, damaged: 0 });
        const e = txMap.get(t.product_id)!;
        if (t.transaction_type === 'sold') {
          e.sold += t.quantity;
          if (t.sale_type === 'wholesale') e.sold_wholesale += t.quantity;
          else e.sold_retail += t.quantity;
        } else if (t.transaction_type === 'received') {
          e.received += t.quantity;
        } else if (t.transaction_type === 'damaged') {
          e.damaged += t.quantity;
        }
      }
      // Pending = leftover from the PREVIOUS DAY only (that day's net stock).
      const prevDate = this.previousDay(date);
      const pendingMap = new Map<number, number>();
      for (const t of all) {
        if (!t.product_id || t.transaction_date !== prevDate) continue;
        const cur = pendingMap.get(t.product_id) ?? 0;
        const delta = t.transaction_type === 'received' ? t.quantity : -t.quantity;
        pendingMap.set(t.product_id, cur + delta);
      }
      const summary: DailyProductSummary[] = DEMO_PRODUCTS.map(p => {
        const agg = txMap.get(p.id) || { received: 0, sold: 0, sold_retail: 0, sold_wholesale: 0, damaged: 0 };
        const pending = Math.max(0, pendingMap.get(p.id) ?? 0);
        return {
          product_id: p.id,
          product_name: p.product_name,
          category_name: DEMO_CATEGORIES.find(c => c.id === p.category_id)?.name ?? 'Other',
          pending,
          received: agg.received, sold: agg.sold,
          sold_retail: agg.sold_retail, sold_wholesale: agg.sold_wholesale,
          damaged: agg.damaged,
          available: pending + agg.received - agg.sold - agg.damaged,
          purchase_price: p.purchase_price ?? 0,
          retail_price: p.retail_price ?? 0,
          wholesale_price: p.wholesale_price ?? 0,
        };
      });
      return success(summary);
    }
    return this.execute<DailyProductSummary[]>(async () => {
      // Fetch all transactions for the date
      const { data: transactions, error: txError } = await supabase
        .from('inventory_transactions')
        .select('product_id, transaction_type, quantity, sale_type')
        .eq('transaction_date', date);

      if (txError) throw txError;

      // Pending = leftover from the PREVIOUS DAY only (that day's net stock).
      const prevDate = this.previousDay(date);
      const { data: priorTx, error: priorErr } = await supabase
        .from('inventory_transactions')
        .select('product_id, transaction_type, quantity')
        .eq('transaction_date', prevDate);

      if (priorErr) throw priorErr;

      // Fetch all active products with prices and category
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, product_name, purchase_price, retail_price, wholesale_price, category_id, categories ( name )')
        .eq('active', true)
        .order('category_id')
        .order('product_name');

      if (prodError) throw prodError;

      // Aggregate transactions per product, splitting sold by sale type
      const txMap = new Map<number, { received: number; sold: number; sold_retail: number; sold_wholesale: number; damaged: number }>();
      for (const tx of transactions || []) {
        if (!tx.product_id) continue;
        if (!txMap.has(tx.product_id)) {
          txMap.set(tx.product_id, { received: 0, sold: 0, sold_retail: 0, sold_wholesale: 0, damaged: 0 });
        }
        const entry = txMap.get(tx.product_id)!;
        if (tx.transaction_type === 'sold') {
          entry.sold += tx.quantity;
          if (tx.sale_type === 'wholesale') entry.sold_wholesale += tx.quantity;
          else entry.sold_retail += tx.quantity;
        } else if (tx.transaction_type === 'received') {
          entry.received += tx.quantity;
        } else if (tx.transaction_type === 'damaged') {
          entry.damaged += tx.quantity;
        }
      }

      // Net of the previous day's transactions = what was left over that day.
      const pendingMap = new Map<number, number>();
      for (const tx of priorTx || []) {
        if (!tx.product_id) continue;
        const cur = pendingMap.get(tx.product_id) ?? 0;
        const delta = tx.transaction_type === 'received' ? tx.quantity : -tx.quantity;
        pendingMap.set(tx.product_id, cur + delta);
      }

      // Build summary
      const summary: DailyProductSummary[] = (products || []).map(p => {
        const agg = txMap.get(p.id) || { received: 0, sold: 0, sold_retail: 0, sold_wholesale: 0, damaged: 0 };
        const pending = Math.max(0, pendingMap.get(p.id) ?? 0);
        return {
          product_id: p.id,
          product_name: p.product_name,
          category_name: (p.categories as unknown as { name: string })?.name ?? 'Uncategorized',
          pending,
          received: agg.received,
          sold: agg.sold,
          sold_retail: agg.sold_retail,
          sold_wholesale: agg.sold_wholesale,
          damaged: agg.damaged,
          available: pending + agg.received - agg.sold - agg.damaged,
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
        // Revenue: retail units × retail price + wholesale units × wholesale price
        totalRevenue += p.sold_retail * p.retail_price + p.sold_wholesale * p.wholesale_price;
        // Cost: all sold units × purchase price
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

  /** Return the calendar day before an ISO date string (YYYY-MM-DD). */
  private previousDay(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d - 1);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

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
