/**
 * inventory.ts — Stock In page: shows products grouped by category,
 * allows recording received quantities via +/- stepper.
 */

import { AppState } from '@/lib/state';
import { categoryService, productService, inventoryService } from '@/services';
import { showToast } from '@/components/toast';
import type { Category, Product, InventoryTransactionInsert } from '@/types/database.types';

let categories: Category[] = [];
let products: Product[] = [];
let activeCategory: Category | null = null;

export async function renderInventory(): Promise<void> {
  if (categories.length === 0) {
    const res = await categoryService.getAll();
    if (res.data) categories = res.data;
  }

  renderCategoryTabs();
  await renderProducts();
}

function renderCategoryTabs(): void {
  const container = document.getElementById('stockCatTabs');
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
  const list = document.getElementById('stockList');
  if (!list || !activeCategory) return;
  list.innerHTML = '<div class="text-center py-8 text-base-content/50">Loading...</div>';

  const prodRes = await productService.getByCategory(activeCategory.id);
  if (!prodRes.data) {
    list.innerHTML = '<div class="text-center py-8 text-base-content/50">Failed to load</div>';
    return;
  }
  products = prodRes.data;

  // Fetch today's summary
  const date = AppState.getDate();
  const summaryRes = await inventoryService.getDailySummary(date);
  const summaryMap = new Map<number, { received: number; sold: number; damaged: number }>();
  if (summaryRes.data) {
    summaryRes.data.forEach(s => summaryMap.set(s.product_id, s));
  }

  // Render product cards
  list.innerHTML = '';
  let currentType = '';

  products.forEach(p => {
    // Sub-type header
    const pType = p.product_type || '';
    if (pType && pType !== currentType) {
      currentType = pType;
      const header = document.createElement('div');
      header.className = 'subtype-head';
      header.textContent = pType;
      list.appendChild(header);
    }

    const agg = summaryMap.get(p.id) || { received: 0, sold: 0, damaged: 0 };

    const card = document.createElement('div');
    card.className = 'product-row';
    card.innerHTML = `
      <div class="info">
        <span class="name">${p.product_name}</span>
        <span class="meta">Received: ${agg.received}</span>
      </div>
      <div class="actions">
        <input type="number" class="stock-input" data-id="${p.id}" value="${agg.received}" min="0" inputmode="numeric" />
      </div>
    `;
    list.appendChild(card);
  });

  // Event delegation — input change for received quantity
  let timer: ReturnType<typeof setTimeout> | null = null;
  list.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('stock-input')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const productId = parseInt(target.dataset.id!);
      const qty = Math.max(0, parseInt(target.value) || 0);
      if (qty > 0) recordReceived(productId, qty);
    }, 800);
  });
}

async function recordReceived(productId: number, qty: number): Promise<void> {
  const tx: InventoryTransactionInsert = {
    product_id: productId,
    transaction_type: 'received',
    quantity: qty,
    transaction_date: AppState.getDate(),
  };

  const res = await inventoryService.recordTransaction(tx);
  if (res.error) {
    showToast(res.error.displayMessage);
    return;
  }

  showToast('+1 received');
  await renderProducts();
}
