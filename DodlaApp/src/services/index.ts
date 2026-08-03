/**
 * services/index.ts — Barrel export for all service instances.
 * Import from '@/services' instead of individual files.
 *
 * Usage:
 *   import { categoryService, productService, inventoryService } from '@/services';
 */

export { categoryService } from './category.service';
export { productService } from './product.service';
export { priceService } from './price.service';
export type { ProductPriceInfo } from './price.service';
export { customerService } from './customer.service';
export { inventoryService } from './inventory.service';
