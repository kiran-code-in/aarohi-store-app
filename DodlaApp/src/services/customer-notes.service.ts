/**
 * customer-notes.service.ts — Customer ledger: payments, balances, notes.
 * Balance = total wholesale purchases − total payments recorded.
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult, success } from '@/lib/error-handler';
import {
  isDemoMode, DEMO_CUSTOMERS, DEMO_PRODUCTS,
  loadDemoTxns, loadDemoNotes, saveDemoNotes, nextNoteId,
} from '@/lib/demo-data';
import type { CustomerNote, CustomerNoteInsert, CustomerBalance } from '@/types/database.types';

class CustomerNotesService extends BaseService {
  protected readonly serviceName = 'CustomerNotesService';

  /** Add a note / payment / balance entry for a customer */
  async addNote(note: CustomerNoteInsert): Promise<ServiceResult<CustomerNote>> {
    const payload = {
      ...note,
      note_date: note.note_date || new Date().toISOString().split('T')[0],
      amount: note.amount ?? 0,
    };
    if (isDemoMode()) {
      const notes = loadDemoNotes();
      const newNote: CustomerNote = {
        id: nextNoteId(), customer_id: note.customer_id, note_type: note.note_type,
        amount: payload.amount, note: note.note ?? null, note_date: payload.note_date,
        created_at: new Date().toISOString(),
      };
      notes.unshift(newNote);
      saveDemoNotes(notes);
      return success(newNote);
    }
    return this.query<CustomerNote>(
      () => supabase
        .from('customer_notes')
        .insert(payload)
        .select()
        .single(),
      'addNote'
    );
  }

  /** Get all notes for a customer, newest first */
  async getNotes(customerId: string): Promise<ServiceResult<CustomerNote[]>> {
    if (isDemoMode()) {
      return success(loadDemoNotes().filter(n => n.customer_id === customerId));
    }
    return this.query<CustomerNote[]>(
      () => supabase
        .from('customer_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false }),
      'getNotes'
    );
  }

  /** Delete a note */
  async deleteNote(id: number): Promise<ServiceResult<boolean>> {
    return this.execute<boolean>(async () => {
      const { error } = await supabase.from('customer_notes').delete().eq('id', id);
      if (error) throw error;
      return true;
    }, 'deleteNote');
  }

  /**
   * Compute balance for a single customer.
   * Balance = total wholesale purchases − total payments.
   */
  async getBalance(customerId: string): Promise<ServiceResult<CustomerBalance>> {
    if (isDemoMode()) {
      const cust = DEMO_CUSTOMERS.find(c => c.id === customerId);
      const txns = loadDemoTxns().filter(t =>
        t.customer_id === customerId && t.transaction_type === 'sold' && t.sale_type === 'wholesale');
      let purchases = 0;
      for (const t of txns) {
        const p = DEMO_PRODUCTS.find(x => x.id === t.product_id);
        purchases += t.quantity * (p?.wholesale_price ?? 0);
      }
      const notes = loadDemoNotes().filter(n => n.customer_id === customerId);
      let paid = 0, opening = 0;
      for (const n of notes) {
        if (n.note_type === 'payment') paid += n.amount ?? 0;
        else if (n.note_type === 'balance') opening += n.amount ?? 0;
      }
      return success({
        customer_id: customerId,
        customer_name: cust?.name ?? 'Unknown',
        total_purchases: purchases + opening,
        total_paid: paid,
        balance: (purchases + opening) - paid,
      });
    }
    return this.execute<CustomerBalance>(async () => {
      // Customer name
      const { data: cust, error: cErr } = await supabase
        .from('customers').select('name').eq('id', customerId).single();
      if (cErr) throw cErr;

      // Total wholesale purchases — join with product prices
      const { data: txns, error: tErr } = await supabase
        .from('inventory_transactions')
        .select('quantity, products ( wholesale_price )')
        .eq('customer_id', customerId)
        .eq('transaction_type', 'sold')
        .eq('sale_type', 'wholesale');
      if (tErr) throw tErr;

      let totalPurchases = 0;
      for (const t of txns || []) {
        const price = (t.products as unknown as { wholesale_price: number })?.wholesale_price ?? 0;
        totalPurchases += t.quantity * price;
      }

      // Total payments
      const { data: notes, error: nErr } = await supabase
        .from('customer_notes')
        .select('amount, note_type')
        .eq('customer_id', customerId);
      if (nErr) throw nErr;

      let totalPaid = 0;
      let openingBalance = 0;
      for (const n of notes || []) {
        if (n.note_type === 'payment') totalPaid += n.amount ?? 0;
        else if (n.note_type === 'balance') openingBalance += n.amount ?? 0;
      }

      return {
        customer_id: customerId,
        customer_name: cust.name,
        total_purchases: totalPurchases + openingBalance,
        total_paid: totalPaid,
        balance: (totalPurchases + openingBalance) - totalPaid,
      };
    }, 'getBalance');
  }

  /**
   * Get balances for ALL customers who have any activity.
   * Returns list sorted by highest outstanding balance.
   */
  async getAllBalances(): Promise<ServiceResult<CustomerBalance[]>> {
    return this.execute<CustomerBalance[]>(async () => {
      const { data: customers, error: cErr } = await supabase
        .from('customers').select('id, name');
      if (cErr) throw cErr;

      // All wholesale transactions with prices
      const { data: txns, error: tErr } = await supabase
        .from('inventory_transactions')
        .select('customer_id, quantity, products ( wholesale_price )')
        .eq('transaction_type', 'sold')
        .eq('sale_type', 'wholesale')
        .not('customer_id', 'is', null);
      if (tErr) throw tErr;

      // All notes
      const { data: notes, error: nErr } = await supabase
        .from('customer_notes').select('customer_id, amount, note_type');
      if (nErr) throw nErr;

      const purchaseMap = new Map<string, number>();
      for (const t of txns || []) {
        if (!t.customer_id) continue;
        const price = (t.products as unknown as { wholesale_price: number })?.wholesale_price ?? 0;
        purchaseMap.set(t.customer_id, (purchaseMap.get(t.customer_id) || 0) + t.quantity * price);
      }

      const paidMap = new Map<string, number>();
      const openingMap = new Map<string, number>();
      for (const n of notes || []) {
        if (n.note_type === 'payment') paidMap.set(n.customer_id, (paidMap.get(n.customer_id) || 0) + (n.amount ?? 0));
        else if (n.note_type === 'balance') openingMap.set(n.customer_id, (openingMap.get(n.customer_id) || 0) + (n.amount ?? 0));
      }

      const balances: CustomerBalance[] = (customers || []).map(c => {
        const purchases = (purchaseMap.get(c.id) || 0) + (openingMap.get(c.id) || 0);
        const paid = paidMap.get(c.id) || 0;
        return {
          customer_id: c.id,
          customer_name: c.name,
          total_purchases: purchases,
          total_paid: paid,
          balance: purchases - paid,
        };
      }).filter(b => b.total_purchases > 0 || b.total_paid > 0);

      balances.sort((a, b) => b.balance - a.balance);
      return balances;
    }, 'getAllBalances');
  }
}

export const customerNotesService = new CustomerNotesService();
