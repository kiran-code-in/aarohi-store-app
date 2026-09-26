/**
 * category.service.ts — CRUD operations for product categories.
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult } from '@/lib/error-handler';
import type { Category, CategoryInsert } from '@/types/database.types';

class CategoryService extends BaseService {
  protected readonly serviceName = 'CategoryService';

  /** Fetch all categories ordered by name */
  async getAll(): Promise<ServiceResult<Category[]>> {
    return this.query<Category[]>(
      () => supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true }),
      'getAll'
    );
  }

  /** Fetch a single category by ID */
  async getById(id: number): Promise<ServiceResult<Category>> {
    return this.query<Category>(
      () => supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single(),
      'getById'
    );
  }

  /** Create a new category */
  async create(category: CategoryInsert): Promise<ServiceResult<Category>> {
    return this.query<Category>(
      () => supabase
        .from('categories')
        .insert(category)
        .select()
        .single(),
      'create'
    );
  }
}

export const categoryService = new CategoryService();
