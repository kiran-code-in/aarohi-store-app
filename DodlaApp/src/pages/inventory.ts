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
type StockAgg = { opening: number; received: number; sold: number; damaged: number; available: number };

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

  // Clicks: received +/-, damage toggle, damage +/-
  list.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;

    // Toggle the damage stepper open/closed
    const toggle = el.closest('[data-dmg-toggle]') as HTMLElement | null;
    if (toggle) {
      const id = toggle.dataset.dmgToggle!;
      const wrap = list.querySelector<HTMLElement>(`[data-dmg-wrap="${id}"]`);
      if (wrap) {
        const open = wrap.style.display !== 'none';
        wrap.style.display = open ? 'none' : 'flex';
        if (!open) list.querySelector<HTMLInputElement>(`.dmg-input[data-id="${id}"]`)?.focus();
      }
      return;
    }

    // "Done" collapses the damage stepper back
    const done = el.closest('[data-dmg-done]') as HTMLElement | null;
    if (done) {
      const id = done.dataset.dmgDone!;
      const wrap = list.querySelector<HTMLElement>(`[data-dmg-wrap="${id}"]`);
      if (wrap) wrap.style.display = 'none';
      return;
    }

    // Received +/-
    const recBtn = el.closest('[data-action]') as HTMLElement | null;
    if (recBtn) {
      const productId = parseInt(recBtn.dataset.id!);
      const input = list.querySelector<HTMLInputElement>(`.stock-input[data-id="${productId}"]`);
      if (!input) return;
      let val = parseInt(input.value) || 0;
      val = recBtn.dataset.action === 'plus' ? val + 1 : Math.max(0, val - 1);
      input.value = String(val);
      setReceived(productId, val);
      return;
    }

    // Damage +/- (capped at the input's max = stock that existed)
    const dmgBtn = el.closest('[data-dmg-action]') as HTMLElement | null;
    if (dmgBtn) {
      const productId = parseInt(dmgBtn.dataset.id!);
      const input = list.querySelector<HTMLInputElement>(`.dmg-input[data-id="${productId}"]`);
      if (!input) return;
      const max = parseInt(input.max) || 0;
      let val = parseInt(input.value) || 0;
      val = dmgBtn.dataset.dmgAction === 'plus' ? Math.min(max, val + 1) : Math.max(0, val - 1);
      input.value = String(val);
      setDamaged(productId, val);
      return;
    }
  });

  // Direct edits saved on blur/Enter (change) for both received and damaged
  list.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const productId = parseInt(target.dataset.id!);
    if (target.classList.contains('stock-input')) {
      const qty = Math.max(0, parseInt(target.value) || 0);
      target.value = String(qty);
      setReceived(productId, qty);
    } else if (target.classList.contains('dmg-input')) {
      const max = parseInt(target.max) || 0;
      const qty = Math.min(max, Math.max(0, parseInt(target.value) || 0));
      target.value = String(qty);
      setDamaged(productId, qty);
    }
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
  const summaryMap = new Map<number, StockAgg>();
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

    const agg = summaryMap.get(p.id) || { opening: 0, received: 0, sold: 0, damaged: 0, available: 0 };
    const dmg = agg.damaged ?? 0;
    // Damage is only recorded against TODAY'S received stock — not opening or
    // available. No stock-in today → no damage entry; cap = today's received.
    const stockBeforeDamage = Math.max(0, agg.received ?? 0);
    const canDamage = stockBeforeDamage > 0;

    const card = document.createElement('div');
    card.className = 'product-row';
    card.style.flexWrap = 'wrap';
    card.innerHTML = `
      <div class="info">
        <span class="name">${p.product_name}</span>
        <span class="meta" data-meta="${p.id}">${metaText(agg.opening ?? 0, agg.available ?? 0)}</span>
      </div>
      <div class="actions" style="display:flex;align-items:center;gap:8px">
        <button data-action="minus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #E2E8F0;background:#fff;font-size:18px;font-weight:700;color:#64748B;cursor:pointer">−</button>
        <input type="number" class="stock-input" data-id="${p.id}" value="${agg.received}" min="0" inputmode="numeric" aria-label="${p.product_name} received" />
        <button data-action="plus" data-id="${p.id}"
          style="width:34px;height:34px;border-radius:9px;border:1.5px solid #0F766E;background:#0F766E;font-size:18px;font-weight:700;color:#fff;cursor:pointer">+</button>
      </div>
      ${canDamage ? `
      <!-- Damage: collapsed summary toggle + expandable stepper (starts collapsed) -->
      <button class="dmg-toggle" data-dmg-toggle="${p.id}"
        style="flex-basis:100%;text-align:left;margin-top:6px;background:none;border:none;padding:0;font-size:11px;font-weight:600;color:${dmg > 0 ? '#DC2626' : '#94A3B8'};cursor:pointer">
        <i class="ph ph-warning-circle"></i> <span class="dmg-label" data-dmg-label="${p.id}">${dmg > 0 ? `Damaged: ${dmg}` : 'Add damage'}</span>
      </button>
      <div class="dmg-wrap" data-dmg-wrap="${p.id}" style="flex-basis:100%;display:none;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed #F1F5F9">
        <span style="font-size:12px;font-weight:600;color:#DC2626">Damaged (max ${stockBeforeDamage})</span>
        <div style="display:flex;align-items:center;gap:8px">
          <button data-dmg-action="minus" data-id="${p.id}"
            style="width:30px;height:30px;border-radius:8px;border:1.5px solid #FCA5A5;background:#fff;font-size:16px;font-weight:700;color:#DC2626;cursor:pointer">−</button>
          <input type="number" class="dmg-input" data-id="${p.id}" value="${dmg}" min="0" max="${stockBeforeDamage}" inputmode="numeric"
            aria-label="${p.product_name} damaged"
            style="width:48px;height:30px;text-align:center;border:1.5px solid #FCA5A5;border-radius:8px;font-size:14px;font-weight:800;color:#DC2626;outline:none" />
          <button data-dmg-action="plus" data-id="${p.id}"
            style="width:30px;height:30px;border-radius:8px;border:1.5px solid #DC2626;background:#DC2626;font-size:16px;font-weight:700;color:#fff;cursor:pointer">+</button>
          <button data-dmg-done="${p.id}"
            style="height:30px;padding:0 10px;border-radius:8px;border:none;background:#0F766E;font-size:12px;font-weight:700;color:#fff;cursor:pointer">Done</button>
        </div>
      </div>` : ''}
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

  // Re-render so the damage option appears/disappears and its cap follows
  // today's received (damage is only allowed against today's stock-in).
  await renderProducts();
}

// Set the EXACT damaged quantity for today (replaces, never adds). Reduces stock.
async function setDamaged(productId: number, qty: number): Promise<void> {
  const res = await inventoryService.setStockQuantity({
    productId,
    date: AppState.getDate(),
    type: 'damaged',
    quantity: qty,
  });
  if (res.error) {
    showToast(res.error.displayMessage);
    return;
  }
  showToast(qty > 0 ? 'Damage recorded' : 'Damage cleared');

  // Re-fetch and re-render so Available reflects the saved damage. Keep the
  // damage stepper for this product open so the user can keep adjusting.
  await renderProducts();
  const wrap = document.querySelector<HTMLElement>(`[data-dmg-wrap="${productId}"]`);
  if (wrap && qty > 0) wrap.style.display = 'flex';
}
