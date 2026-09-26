/**
 * customer-notes.service.ts — Customer ledger: payments, balances, notes.
 * Balance = total wholesale purchases − total payments recorded.
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult } from '@/lib/error-handler';
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
    // Read the pre-aggregated balance from the DB view (avoids the 1000-row
    // cap that undercounted purchases for high-volume customers).
    return this.execute<CustomerBalance>(async () => {
      const { data, error } = await supabase
        .from('customer_balances')
        .select('customer_id, customer_name, total_purchases, total_paid, balance, has_estimated_prices')
        .eq('customer_id', customerId)
        .single();
      if (error) throw error;

      return {
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        total_purchases: Number(data.total_purchases) || 0,
        total_paid: Number(data.total_paid) || 0,
        balance: Number(data.balance) || 0,
        has_estimated_prices: Boolean(data.has_estimated_prices),
      };
    }, 'getBalance');
  }

  /**
   * Get balances for ALL customers who have any activity.
   * Returns list sorted by highest outstanding balance.
   */
  async getAllBalances(): Promise<ServiceResult<CustomerBalance[]>> {
    // Read pre-aggregated balances from the DB view. This avoids Supabase's
    // 1000-row cap that silently undercounted purchases when summing raw
    // transaction rows client-side.
    return this.execute<CustomerBalance[]>(async () => {
      const { data, error } = await supabase
        .from('customer_balances')
        .select('customer_id, customer_name, total_purchases, total_paid, balance, has_estimated_prices')
        .order('balance', { ascending: false });
      if (error) throw error;

      return (data || [])
        .map(b => ({
          customer_id: b.customer_id,
          customer_name: b.customer_name,
          total_purchases: Number(b.total_purchases) || 0,
          total_paid: Number(b.total_paid) || 0,
          balance: Number(b.balance) || 0,
          has_estimated_prices: Boolean(b.has_estimated_prices),
        }))
        .filter(b => b.total_purchases !== 0 || b.total_paid !== 0);
    }, 'getAllBalances');
  }
}

export const customerNotesService = new CustomerNotesService();
