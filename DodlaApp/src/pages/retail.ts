/**
 * retail.ts — Retail sales page: tap + to record a sale for each product.
 */

import { AppState } from '@/lib/state';
import { categoryService, productService, inventoryService } from '@/services';
import { priceService } from '@/services';
import { showToast } from '@/components/toast';
import type { Category, InventoryTransactionInsert } from '@/types/database.types';

let categories: Category[] = [];
let activeCategory: Category | null = null;

export async function renderRetail(): Promise<void> {
  if (categories.length === 0) {
    const res = await categoryService.getAll();
    if (res.data) categories = res.data;
  }

  renderCategoryTabs();
  await renderProducts();
}

function renderCategoryTabs(): void {
  const container = document.getElementById('salesCatTabs');
  if (!container) return;
  container.innerHTML = '';

  if (!activeCategory && categories.length > 0) {
    activeCategory = categories[0];
  }

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat.id === activeCategory?.id ? ' active' : '');
    btn.textContent = cat.name;
    btn.addEventListener('click', async () => {
      activeCategory = cat;
      renderCategoryTabs();
      await renderProducts();
    });
    container.appendChild(btn);
  });
}

async function renderProducts(): Promise<void> {
  const list = document.getElementById('salesList');
  if (!list || !activeCategory) return;
  list.innerHTML = '<div class="text-center py-8 text-muted text-caption">Loading...</div>';

  const prodRes = await productService.getByCategory(activeCategory.id);
  if (!prodRes.data) {
    list.innerHTML = '<div class="text-center py-8 text-muted text-caption">Failed to load</div>';
    return;
  }

  // Fetch today's retail sales
  const date = AppState.getDate();
  const txRes = await inventoryService.getDailyTransactions(date);
  const soldMap = new Map<number, number>();
  if (txRes.data) {
    txRes.data
      .filter(tx => tx.transaction_type === 'sold' && tx.sale_type === 'retail')
      .forEach(tx => {
        if (tx.product_id) soldMap.set(tx.product_id, (soldMap.get(tx.product_id) || 0) + tx.quantity);
      });
  }

  // Prices
  const pricesRes = await priceService.getAllCurrentPrices();
  const priceMap = new Map<number, number>();
  if (pricesRes.data) {
    pricesRes.data.forEach(p => priceMap.set(p.product_id, p.retail_price));
  }

  list.innerHTML = '';
  let currentType = '';

  prodRes.data.forEach(p => {
    const pType = p.product_type || '';
    if (pType && pType !== currentType) {
      currentType = pType;
      const header = document.createElement('div');
      header.className = 'subtype-head';
      header.textContent = pType;
      list.appendChild(header);
    }

    const sold = soldMap.get(p.id) || 0;
    const price = priceMap.get(p.id) || 0;

    const card = document.createElement('div');
    card.className = 'product-row';
    card.innerHTML = `
      <div class="info">
        <span class="name">${p.product_name}</span>
        <span class="meta">₹${price} · Sold: ${sold}</span>
      </div>
      <div class="actions">
        <div class="stepper">
          <button data-action="minus" data-id="${p.id}">−</button>
          <span class="count">${sold}</span>
          <button data-action="plus" data-id="${p.id}">+</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  // Event delegation
  list.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-action]') as HTMLElement | null;
    if (!btn) return;

    const action = btn.dataset.action;
    const productId = parseInt(btn.dataset.id!);
    if (action === 'plus') recordRetailSale(productId, 1);
  });
}

async function recordRetailSale(productId: number, qty: number): Promise<void> {
  const tx: InventoryTransactionInsert = {
    product_id: productId,
    transaction_type: 'sold',
    quantity: qty,
    transaction_date: AppState.getDate(),
    sale_type: 'retail',
  };

  const res = await inventoryService.recordTransaction(tx);
  if (res.error) {
    showToast(res.error.displayMessage);
    return;
  }

  showToast('+1 sold');
  await renderProducts();
}
