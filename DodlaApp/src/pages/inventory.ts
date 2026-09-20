/**
 * inventory.ts — Stock In page: shows products grouped by category,
 * allows recording received quantities via +/- stepper.
 */

import { AppState } from '@/lib/state';
import { categoryService, productService, inventoryService } from '@/services';
import { showToast } from '@/components/toast';
import type { Category, Product } from '@/types/database.types';

let categories: Category[] = [];
let products: Product[] = [];
let activeCategory: Category | null = null;
let listenersBound = false;
// Latest per-product summary so we can refresh the "Available" label in place
// after an edit without re-rendering the whole list.
let lastSummary = new Map<number, { opening: number; received: number; sold: number; available: number }>();

export async function renderInventory(): Promise<void> {
  if (categories.length === 0) {
    const res = await categoryService.getAll();
    if (res.data) categories = res.data;
  }

  bindStockListeners();
  renderCategoryTabs();
  await renderProducts();
}

// Bind list event listeners ONCE. Previously these were attached inside
// renderProducts(), so every category switch / re-render stacked another
// duplicate listener on the same #stockList element — causing a single
// edit to fire setReceived multiple times and the quantity to keep growing.
function bindStockListeners(): void {
  if (listenersBound) return;
  const list = document.getElementById('stockList');
  if (!list) return;
  listenersBound = true;

  // +/- buttons — adjust the input then save the exact value
  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn) return;
    const productId = parseInt(btn.dataset.id!);
    const input = list.querySelector<HTMLInputElement>(`.stock-input[data-id="${productId}"]`);
    if (!input) return;
    let val = parseInt(input.value) || 0;
    val = btn.dataset.action === 'plus' ? val + 1 : Math.max(0, val - 1);
    input.value = String(val);
    setReceived(productId, val);
  });

  // Direct input edit — save the EXACT value the moment the field loses
  // focus (change fires on blur / Enter). This is the "went back" moment,
  // so the typed value is always persisted before navigating away.
  list.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('stock-input')) return;
    const productId = parseInt(target.dataset.id!);
    const qty = Math.max(0, parseInt(target.value) || 0);
    target.value = String(qty);
    setReceived(productId, qty);
  });
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
  list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748B;font-size:13px">Loading...</div>';

  const prodRes = await productService.getByCategory(activeCategory.id);
  if (!prodRes.data) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748B;font-size:13px">Failed to load</div>';
    return;
  }
  products = prodRes.data;

  // Fetch today's summary
  const date = AppState.getDate();
  const summaryRes = await inventoryService.getDailySummary(date);
  const summaryMap = new Map<number, { opening: number; received: number; sold: number; available: number }>();
  if (summaryRes.data) {
    summaryRes.data.forEach(s => summaryMap.set(s.product_id, s));
  }
  lastSummary = summaryMap;

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

    const agg = summaryMap.get(p.id) || { opening: 0, received: 0, sold: 0, available: 0 };

    const card = document.createElement('div');
    card.className = 'product-row';
    card.innerHTML = `
      <div class="info">
        <span class="name">${p.product_name}</span>
        <span class="meta" data-meta="${p.id}">${metaText(agg.opening ?? 0, agg.available ?? 0)}</span>
      </div>
      <div class="actions" style="display:flex;align-items:center;gap:8px">
        <button data-action="minus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #E2E8F0;background:#fff;font-size:18px;font-weight:700;color:#64748B;cursor:pointer">−</button>
        <input type="number" class="stock-input" data-id="${p.id}" value="${agg.received}" min="0" inputmode="numeric" />
        <button data-action="plus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #0F766E;background:#0F766E;font-size:18px;font-weight:700;color:#fff;cursor:pointer">+</button>
      </div>
    `;
    list.appendChild(card);
  });
}

// Meta line: opening stock carried in from all prior days, plus the current
// available-to-sell total (opening + today's received - today's sold).
function metaText(opening: number, available: number): string {
  return `Opening: ${opening} · Available: ${available}`;
}

// Set the EXACT received quantity for today (replaces, never adds)
async function setReceived(productId: number, qty: number): Promise<void> {
  const res = await inventoryService.setStockQuantity({
    productId,
    date: AppState.getDate(),
    type: 'received',
    quantity: qty,
  });
  if (res.error) {
    showToast(res.error.displayMessage);
    return;
  }
  showToast('Stock updated');

  // Refresh this product's "Available" label in place (received changed).
  const agg = lastSummary.get(productId);
  if (agg) {
    agg.received = qty;
    agg.available = Math.max(0, agg.opening + qty - agg.sold);
    const metaEl = document.querySelector(`[data-meta="${productId}"]`);
    if (metaEl) metaEl.innerHTML = metaText(agg.opening, agg.available);
  }
}
