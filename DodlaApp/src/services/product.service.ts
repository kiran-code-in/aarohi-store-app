/**
 * product.service.ts — CRUD and query operations for products.
 */

import { BaseService } from '@/lib/base-service';
import { supabase } from '@/lib/supabase';
import { ServiceResult } from '@/lib/error-handler';
import type { Product, ProductInsert, ProductUpdate, ProductWithCategory } from '@/types/database.types';

class ProductService extends BaseService {
  protected readonly serviceName = 'ProductService';

  /** Fetch all products with category name, ordered by category then name */
  async getAll(): Promise<ServiceResult<ProductWithCategory[]>> {
    return this.query<ProductWithCategory[]>(
      () => supabase
        .from('products')
        .select(`
          *,
          categories ( name )
        `)
        .order('category_id', { ascending: true })
        .order('product_name', { ascending: true })
        .then(({ data, error }) => ({
          data: data?.map(p => ({
            ...p,
            category_name: (p.categories as unknown as { name: string })?.name ?? 'Uncategorized',
          })) as ProductWithCategory[] | null,
          error,
        })),
      'getAll'
    );
  }

  /** Fetch only active products */
  async getActive(): Promise<ServiceResult<ProductWithCategory[]>> {
    return this.query<ProductWithCategory[]>(
      () => supabase
        .from('products')
        .select(`
          *,
          categories ( name )
        `)
        .eq('active', true)
        .order('category_id', { ascending: true })
        .order('product_name', { ascending: true })
        .then(({ data, error }) => ({
          data: data?.map(p => ({
            ...p,
            category_name: (p.categories as unknown as { name: string })?.name ?? 'Uncategorized',
          })) as ProductWithCategory[] | null,
          error,
        })),
      'getActive'
    );
  }

  /** Fetch products by category ID */
  async getByCategory(categoryId: number): Promise<ServiceResult<Product[]>> {
    return this.query<Product[]>(
      () => supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryId)
        .eq('active', true)
        .order('product_type', { ascending: true, nullsFirst: true })
        .order('product_name', { ascending: true }),
      'getByCategory'
    );
  }

  /** Fetch a single product by ID */
  async getById(id: number): Promise<ServiceResult<Product>> {
    return this.query<Product>(
      () => supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single(),
      'getById'
    );
  }

  /** Search products by name (case-insensitive partial match) */
  async search(query: string): Promise<ServiceResult<Product[]>> {
    return this.query<Product[]>(
      () => supabase
        .from('products')
        .select('*')
        .ilike('product_name', `%${query}%`)
        .eq('active', true)
        .order('product_name', { ascending: true })
        .limit(20),
      'search'
    );
  }

  /** Create a new product */
  async create(product: ProductInsert): Promise<ServiceResult<Product>> {
    return this.query<Product>(
      () => supabase
        .from('products')
        .insert(product)
        .select()
        .single(),
      'create'
    );
  }

  /** Update an existing product */
  async update(id: number, updates: ProductUpdate): Promise<ServiceResult<Product>> {
    return this.query<Product>(
      () => supabase
        .from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
      'update'
    );
  }

  /** Soft-delete (deactivate) a product */
  async deactivate(id: number): Promise<ServiceResult<Product>> {
    return this.update(id, { active: false });
  }
}

export const productService = new ProductService();
