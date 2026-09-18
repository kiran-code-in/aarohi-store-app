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
    // Read the pre-aggregated balance from the DB view (avoids the 1000-row
    // cap that undercounted purchases for high-volume customers).
    return this.execute<CustomerBalance>(async () => {
      const { data, error } = await supabase
        .from('customer_balances')
        .select('customer_id, customer_name, total_purchases, total_paid, balance')
        .eq('customer_id', customerId)
        .single();
      if (error) throw error;

      return {
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        total_purchases: Number(data.total_purchases) || 0,
        total_paid: Number(data.total_paid) || 0,
        balance: Number(data.balance) || 0,
      };
    }, 'getBalance');
  }

  /**
   * Get balances for ALL customers who have any activity.
   * Returns list sorted by highest outstanding balance.
   */
  async getAllBalances(): Promise<ServiceResult<CustomerBalance[]>> {
    if (isDemoMode()) {
      const balances: CustomerBalance[] = DEMO_CUSTOMERS.map(c => {
        const txns = loadDemoTxns().filter(t =>
          t.customer_id === c.id && t.transaction_type === 'sold' && t.sale_type === 'wholesale');
        let purchases = 0;
        for (const t of txns) {
          const p = DEMO_PRODUCTS.find(x => x.id === t.product_id);
          purchases += t.quantity * (p?.wholesale_price ?? 0);
        }
        const notes = loadDemoNotes().filter(n => n.customer_id === c.id);
        let paid = 0, opening = 0;
        for (const n of notes) {
          if (n.note_type === 'payment') paid += n.amount ?? 0;
          else if (n.note_type === 'balance') opening += n.amount ?? 0;
        }
        return {
          customer_id: c.id, customer_name: c.name,
          total_purchases: purchases + opening, total_paid: paid,
          balance: (purchases + opening) - paid,
        };
      }).filter(b => b.total_purchases !== 0 || b.total_paid !== 0);
      balances.sort((a, b) => b.balance - a.balance);
      return success(balances);
    }

    // Read pre-aggregated balances from the DB view. This avoids Supabase's
    // 1000-row cap that silently undercounted purchases when summing raw
    // transaction rows client-side.
    return this.execute<CustomerBalance[]>(async () => {
      const { data, error } = await supabase
        .from('customer_balances')
        .select('customer_id, customer_name, total_purchases, total_paid, balance')
        .order('balance', { ascending: false });
      if (error) throw error;

      return (data || [])
        .map(b => ({
          customer_id: b.customer_id,
          customer_name: b.customer_name,
          total_purchases: Number(b.total_purchases) || 0,
          total_paid: Number(b.total_paid) || 0,
          balance: Number(b.balance) || 0,
        }))
        .filter(b => b.total_purchases !== 0 || b.total_paid !== 0);
    }, 'getAllBalances');
  }
}

export const customerNotesService = new CustomerNotesService();
