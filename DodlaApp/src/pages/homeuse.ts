/**
 * homeuse.ts — Home Use page: items your dad takes home for personal use.
 * These reduce stock like a sale but are valued at PURCHASE (bought) price and
 * excluded from revenue and profit. Saved as transaction_type='personal'.
 */

import { AppState } from '@/lib/state';
import { categoryService, productService, inventoryService } from '@/services';
import { priceService } from '@/services';
import { showToast } from '@/components/toast';
import type { Category } from '@/types/database.types';

let categories: Category[] = [];
let activeCategory: Category | null = null;
let listenersBound = false;

export async function renderHomeUse(): Promise<void> {
  if (categories.length === 0) {
    const res = await categoryService.getAll();
    if (res.data) categories = res.data;
  }
  bindListeners();
  renderCategoryTabs();
  await renderProducts();
}

function bindListeners(): void {
  if (listenersBound) return;
  const list = document.getElementById('homeUseList');
  if (!list) return;
  listenersBound = true;

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn) return;
    const productId = parseInt(btn.dataset.id!);
    const input = list.querySelector<HTMLInputElement>(`.home-input[data-id="${productId}"]`);
    if (!input) return;
    let val = parseInt(input.value) || 0;
    val = btn.dataset.action === 'plus' ? val + 1 : Math.max(0, val - 1);
    input.value = String(val);
    setPersonalQty(productId, val);
  });

  list.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('home-input')) return;
    const productId = parseInt(input.dataset.id!);
    const qty = Math.max(0, parseInt(input.value) || 0);
    input.value = String(qty);
    setPersonalQty(productId, qty);
  });
}

function renderCategoryTabs(): void {
  const container = document.getElementById('homeUseCatTabs');
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
  const list = document.getElementById('homeUseList');
  if (!list || !activeCategory) return;
  list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748B;font-size:13px">Loading...</div>';

  const prodRes = await productService.getByCategory(activeCategory.id);
  if (!prodRes.data) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748B;font-size:13px">Failed to load</div>';
    return;
  }

  const date = AppState.getDate();
  const summaryRes = await inventoryService.getDailySummary(date);
  const availMap = new Map<number, number>();
  if (summaryRes.data) {
    summaryRes.data.forEach(s => availMap.set(s.product_id, s.available));
  }

  // Today's home-use quantities already recorded
  const txRes = await inventoryService.getDailyTransactions(date);
  const homeMap = new Map<number, number>();
  if (txRes.data) {
    txRes.data
      .filter(tx => tx.transaction_type === 'personal')
      .forEach(tx => {
        if (tx.product_id) homeMap.set(tx.product_id, (homeMap.get(tx.product_id) || 0) + tx.quantity);
      });
  }

  // Purchase (bought) prices — home use is valued at cost
  const pricesRes = await priceService.getAllCurrentPrices();
  const costMap = new Map<number, number>();
  if (pricesRes.data) {
    pricesRes.data.forEach(p => costMap.set(p.product_id, p.purchase_price));
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

    const qty = homeMap.get(p.id) ?? 0;
    const cost = costMap.get(p.id) ?? 0;
    const avail = availMap.get(p.id) ?? 0;

    const card = document.createElement('div');
    card.className = 'product-row';
    card.innerHTML = `
      <div class="info">
        <span class="name">${p.product_name}</span>
        <span class="meta">₹${cost} cost · ${avail} in stock</span>
      </div>
      <div class="actions" style="display:flex;align-items:center;gap:8px">
        <button data-action="minus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #E2E8F0;background:#fff;font-size:18px;font-weight:700;color:#64748B;cursor:pointer">−</button>
        <input class="home-input" type="number" min="0" data-id="${p.id}" value="${qty}"
          aria-label="${p.product_name} taken home"
          style="width:52px;height:34px;text-align:center;border:1.5px solid #E2E8F0;border-radius:9px;font-size:15px;font-weight:800;color:#0F172A;outline:none" />
        <button data-action="plus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #0F766E;background:#0F766E;font-size:18px;font-weight:700;color:#fff;cursor:pointer">+</button>
      </div>
    `;
    list.appendChild(card);
  });
}

// Set exact home-use quantity for the day (replaces, never adds).
async function setPersonalQty(productId: number, qty: number): Promise<void> {
  const res = await inventoryService.setStockQuantity({
    productId,
    date: AppState.getDate(),
    type: 'personal',
    quantity: qty,
  });
  if (res.error) {
    showToast(res.error.displayMessage);
    return;
  }
  showToast('Updated');
}
