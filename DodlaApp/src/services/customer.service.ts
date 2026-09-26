/**
 * customer.service.ts — CRUD operations for customers (wholesale buyers).
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult } from '@/lib/error-handler';
import type { Customer, CustomerInsert, CustomerUpdate, CustomerType } from '@/types/database.types';

class CustomerService extends BaseService {
  protected readonly serviceName = 'CustomerService';

  /** Fetch all customers ordered by name */
  async getAll(): Promise<ServiceResult<Customer[]>> {
    return this.query<Customer[]>(
      () => supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true }),
      'getAll'
    );
  }

  /** Fetch customers by type (wholesale, retail, both) */
  async getByType(type: CustomerType): Promise<ServiceResult<Customer[]>> {
    return this.query<Customer[]>(
      () => supabase
        .from('customers')
        .select('*')
        .eq('customer_type', type)
        .order('name', { ascending: true }),
      'getByType'
    );
  }

  /** Fetch a single customer by ID */
  async getById(id: string): Promise<ServiceResult<Customer>> {
    return this.query<Customer>(
      () => supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single(),
      'getById'
    );
  }

  /** Search customers by name (case-insensitive partial match) */
  async search(query: string): Promise<ServiceResult<Customer[]>> {
    return this.query<Customer[]>(
      () => supabase
        .from('customers')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(20),
      'search'
    );
  }

  /** Create a new customer */
  async create(customer: CustomerInsert): Promise<ServiceResult<Customer>> {
    return this.query<Customer>(
      () => supabase
        .from('customers')
        .insert(customer)
        .select()
        .single(),
      'create'
    );
  }

  /** Update an existing customer */
  async update(id: string, updates: CustomerUpdate): Promise<ServiceResult<Customer>> {
    return this.query<Customer>(
      () => supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single(),
      'update'
    );
  }
}

export const customerService = new CustomerService();
