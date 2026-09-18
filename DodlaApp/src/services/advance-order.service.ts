/**
 * advance-order.service.ts — Advance orders (pre-orders / bookings).
 *
 * A customer pays an advance (full or partial) for specific items to be
 * delivered on a requested date. On delivery we record the items as a
 * wholesale sale and log the advance as a payment so balances net out.
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult, ApiError, failure } from '@/lib/error-handler';
import { inventoryService } from './inventory.service';
import { customerNotesService } from './customer-notes.service';
import type {
  AdvanceOrder,
  AdvanceOrderInsert,
  AdvanceOrderView,
  AdvanceItemRollup,
} from '@/types/database.types';

class AdvanceOrderService extends BaseService {
  protected readonly serviceName = 'AdvanceOrderService';

  /**
   * Create an advance order with its line items in one call.
   * `items` = products the customer pre-ordered with quantities.
   */
  async create(
    order: AdvanceOrderInsert,
    items: Array<{ product_id: number; quantity: number }>
  ): Promise<ServiceResult<AdvanceOrder>> {
    const validItems = items.filter(i => i.quantity > 0);
    if (validItems.length === 0) {
      return failure<AdvanceOrder>(
        new ApiError('Add at least one item with a quantity', 'VALIDATION_ERROR')
      );
    }

    return this.execute<AdvanceOrder>(async () => {
      const { data: created, error: oErr } = await supabase
        .from('advance_orders')
        .insert({
          customer_id: order.customer_id,
          order_date: order.order_date ?? new Date().toISOString().split('T')[0],
          requested_date: order.requested_date,
          advance_amount: order.advance_amount,
          paid_full: order.paid_full ?? false,
          note: order.note ?? null,
          status: 'pending',
        })
        .select()
        .single();
      if (oErr) throw oErr;

      const rows = validItems.map(i => ({
        order_id: created.id,
        product_id: i.product_id,
        quantity: i.quantity,
      }));
      const { error: iErr } = await supabase.from('advance_order_items').insert(rows);
      if (iErr) throw iErr;

      return created as AdvanceOrder;
    }, 'create');
  }

  /**
   * List orders by status (default 'pending'), enriched with customer name,
   * item details and computed order total. Sorted by requested date.
   */
  async list(status: AdvanceOrder['status'] = 'pending'): Promise<ServiceResult<AdvanceOrderView[]>> {
    return this.execute<AdvanceOrderView[]>(async () => {
      const { data: orders, error: oErr } = await supabase
        .from('advance_orders')
        .select('*, customers ( name )')
        .eq('status', status)
        .order('requested_date', { ascending: true });
      if (oErr) throw oErr;

      const orderIds = (orders || []).map(o => o.id);
      if (orderIds.length === 0) return [];

      // Items for these orders, joined with product name + wholesale price
      const { data: items, error: iErr } = await supabase
        .from('advance_order_items')
        .select('order_id, product_id, quantity, products ( product_name, wholesale_price )')
        .in('order_id', orderIds);
      if (iErr) throw iErr;

      const itemsByOrder = new Map<number, AdvanceOrderView['items']>();
      for (const it of items || []) {
        const prod = it.products as unknown as { product_name: string; wholesale_price: number } | null;
        const arr = itemsByOrder.get(it.order_id) ?? [];
        arr.push({
          product_id: it.product_id,
          product_name: prod?.product_name ?? 'Unknown',
          quantity: it.quantity,
          wholesale_price: prod?.wholesale_price ?? 0,
        });
        itemsByOrder.set(it.order_id, arr);
      }

      return (orders || []).map(o => {
        const its = itemsByOrder.get(o.id) ?? [];
        const total = its.reduce((a, x) => a + x.quantity * x.wholesale_price, 0);
        return {
          ...(o as AdvanceOrder),
          customer_name: (o.customers as unknown as { name: string })?.name ?? 'Unknown',
          items: its,
          order_total: total,
        };
      });
    }, 'list');
  }

  /**
   * Total quantity needed per product across all pending orders — so stock
   * can be arranged in one glance.
   */
  async pendingItemRollup(): Promise<ServiceResult<AdvanceItemRollup[]>> {
    return this.execute<AdvanceItemRollup[]>(async () => {
      const { data: orders, error: oErr } = await supabase
        .from('advance_orders')
        .select('id')
        .eq('status', 'pending');
      if (oErr) throw oErr;

      const ids = (orders || []).map(o => o.id);
      if (ids.length === 0) return [];

      const { data: items, error: iErr } = await supabase
        .from('advance_order_items')
        .select('product_id, quantity, products ( product_name )')
        .in('order_id', ids);
      if (iErr) throw iErr;

      const map = new Map<number, AdvanceItemRollup>();
      for (const it of items || []) {
        const name = (it.products as unknown as { product_name: string })?.product_name ?? 'Unknown';
        const cur = map.get(it.product_id) ?? { product_id: it.product_id, product_name: name, total_quantity: 0 };
        cur.total_quantity += it.quantity;
        map.set(it.product_id, cur);
      }
      return [...map.values()].sort((a, b) => a.product_name.localeCompare(b.product_name));
    }, 'pendingItemRollup');
  }

  /**
   * Mark an order delivered on `deliveredDate`:
   *   1. record each item as a wholesale 'sold' transaction for the customer
   *   2. log the advance as a payment (so the balance nets out; partials leave
   *      a remaining balance due)
   */
  async markDelivered(orderId: number, deliveredDate: string): Promise<ServiceResult<boolean>> {
    return this.execute<boolean>(async () => {
      // Load the order + its items
      const { data: order, error: oErr } = await supabase
        .from('advance_orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (oErr) throw oErr;
      if (order.status !== 'pending') {
        throw new ApiError('Order is not pending', 'CONFLICT');
      }

      const { data: items, error: iErr } = await supabase
        .from('advance_order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);
      if (iErr) throw iErr;

      // 1. Record each ordered item as a wholesale sale on the delivery date
      for (const it of items || []) {
        if (it.quantity <= 0) continue;
        const res = await inventoryService.recordTransaction({
          product_id: it.product_id,
          transaction_type: 'sold',
          quantity: it.quantity,
          transaction_date: deliveredDate,
          sale_type: 'wholesale',
          customer_id: order.customer_id,
          remarks: `Advance order #${orderId}`,
        });
        if (res.error) throw res.error;
      }

      // 2. Log the advance as a payment so the balance settles/partially settles
      if ((order.advance_amount ?? 0) > 0) {
        const res = await customerNotesService.addNote({
          customer_id: order.customer_id,
          note_type: 'payment',
          amount: order.advance_amount,
          note: `Advance for order #${orderId}`,
          note_date: order.order_date ?? deliveredDate,
        });
        if (res.error) throw res.error;
      }

      // 3. Flip status
      const { error: uErr } = await supabase
        .from('advance_orders')
        .update({ status: 'delivered', delivered_date: deliveredDate })
        .eq('id', orderId);
      if (uErr) throw uErr;

      return true;
    }, 'markDelivered');
  }

  /** Cancel a pending order (no stock/payment side effects). */
  async cancel(orderId: number): Promise<ServiceResult<boolean>> {
    return this.execute<boolean>(async () => {
      const { error } = await supabase
        .from('advance_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('status', 'pending');
      if (error) throw error;
      return true;
    }, 'cancel');
  }
}

export const advanceOrderService = new AdvanceOrderService();
