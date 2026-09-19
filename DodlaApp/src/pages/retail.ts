/**
 * retail.ts — Retail sales page: tap + to record a sale for each product.
 */

import { AppState } from '@/lib/state';
import { categoryService, productService, inventoryService } from '@/services';
import { priceService } from '@/services';
import { showToast } from '@/components/toast';
import type { Category } from '@/types/database.types';

let categories: Category[] = [];
let activeCategory: Category | null = null;
let listenersBound = false;

export async function renderRetail(): Promise<void> {
  if (categories.length === 0) {
    const res = await categoryService.getAll();
    if (res.data) categories = res.data;
  }

  bindSalesListeners();
  renderCategoryTabs();
  await renderProducts();
}

// Bind list listeners ONCE. Previously they were attached inside
// renderProducts(), so every category switch stacked another duplicate on
// the same #salesList element — one edit fired setRetailQty multiple times
// and the quantity kept climbing (same bug the Stock In page had).
function bindSalesListeners(): void {
  if (listenersBound) return;
  const list = document.getElementById('salesList');
  if (!list) return;
  listenersBound = true;

  // +/- buttons — adjust the input then save the exact value
  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn) return;
    const productId = parseInt(btn.dataset.id!);
    const input = list.querySelector<HTMLInputElement>(`.retail-input[data-id="${productId}"]`);
    if (!input) return;
    let val = parseInt(input.value) || 0;
    val = btn.dataset.action === 'plus' ? val + 1 : Math.max(0, val - 1);
    input.value = String(val);
    setRetailQty(productId, val);
  });

  // Direct edit — save the EXACT value when the field loses focus (blur /
  // Enter). Only the final value is saved, never mid-typing empty states.
  list.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('retail-input')) return;
    const productId = parseInt(input.dataset.id!);
    const qty = Math.max(0, parseInt(input.value) || 0);
    input.value = String(qty);
    setRetailQty(productId, qty);
  });
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
  list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748B;font-size:13px">Loading...</div>';

  const prodRes = await productService.getByCategory(activeCategory.id);
  if (!prodRes.data) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748B;font-size:13px">Failed to load</div>';
    return;
  }

  // Fetch today's summary (retail sold + available stock per product)
  const date = AppState.getDate();
  const summaryRes = await inventoryService.getDailySummary(date);
  const availMap = new Map<number, number>();
  if (summaryRes.data) {
    summaryRes.data.forEach(s => availMap.set(s.product_id, s.available));
  }

  // Retail sold today (what's already in each input)
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
    const avail = availMap.get(p.id) ?? 0;
    const stockColor = avail <= 0 ? '#DC2626' : avail <= 3 ? '#D97706' : '#0F766E';

    const card = document.createElement('div');
    card.className = 'product-row';
    card.innerHTML = `
      <div class="info">
        <span class="name">${p.product_name}</span>
        <span class="meta">₹${price} each · <span style="color:${stockColor};font-weight:700">${avail} in stock</span></span>
      </div>
      <div class="actions" style="display:flex;align-items:center;gap:8px">
        <button data-action="minus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #E2E8F0;background:#fff;font-size:18px;font-weight:700;color:#64748B;cursor:pointer">−</button>
        <input class="retail-input" type="number" min="0" data-id="${p.id}" value="${sold}"
          style="width:52px;height:34px;text-align:center;border:1.5px solid #E2E8F0;border-radius:9px;font-size:15px;font-weight:800;color:#0F172A;outline:none" />
        <button data-action="plus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #0F766E;background:#0F766E;font-size:18px;font-weight:700;color:#fff;cursor:pointer">+</button>
      </div>
    `;
    list.appendChild(card);
  });
}

// Set exact retail sold quantity (handles corrections)
async function setRetailQty(productId: number, qty: number): Promise<void> {
  const res = await inventoryService.setSoldQuantity({
    productId,
    date: AppState.getDate(),
    saleType: 'retail',
    quantity: qty,
  });
  if (res.error) {
    showToast(res.error.displayMessage);
    return;
  }
  showToast('Updated');
}
