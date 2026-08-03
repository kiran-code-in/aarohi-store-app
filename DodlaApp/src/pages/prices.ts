/**
 * prices.ts — Compact price table for fast editing.
 */

import { productService, priceService } from '@/services';
import { showToast } from '@/components/toast';

export async function renderPrices(): Promise<void> {
  const tbody = document.getElementById('priceTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Loading...</td></tr>';

  const prodRes = await productService.getActive();
  if (!prodRes.data) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Failed to load</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  let currentCat = '';

  prodRes.data.forEach(p => {
    const catName = (p as unknown as { category_name: string }).category_name || '';
    if (catName !== currentCat) {
      currentCat = catName;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" class="text-[10px] font-bold uppercase tracking-wider text-primary pt-3 pb-1">${catName}</td>`;
      tbody.appendChild(tr);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold text-body">${p.product_name}</td>
      <td><input type="number" data-id="${p.id}" data-field="purchase_price" value="${p.purchase_price ?? 0}" step="0.5" /></td>
      <td><input type="number" data-id="${p.id}" data-field="retail_price" value="${p.retail_price ?? 0}" step="0.5" /></td>
      <td><input type="number" data-id="${p.id}" data-field="wholesale_price" value="${p.wholesale_price ?? 0}" step="0.5" /></td>
    `;
    tbody.appendChild(tr);
  });

  // Save on change
  tbody.addEventListener('change', async (e) => {
    const inp = e.target as HTMLInputElement;
    if (!inp.dataset.id) return;
    const id = parseInt(inp.dataset.id);
    const field = inp.dataset.field!;
    const val = parseFloat(inp.value) || 0;

    const prices: Record<string, number> = {};
    prices[field] = val;
    const res = await priceService.updatePrice(id, prices as { purchase_price?: number; retail_price?: number; wholesale_price?: number });
    if (res.error) showToast(res.error.displayMessage);
    else showToast('Saved');
  });

  await renderPriceHistory();
}

async function renderPriceHistory(): Promise<void> {
  const list = document.getElementById('priceHistoryList');
  if (!list) return;
  const res = await priceService.getAllPriceHistory(15);
  if (!res.data || res.data.length === 0) {
    list.innerHTML = '<div class="text-caption text-muted py-3">No changes yet</div>';
    return;
  }
  const prodRes = await productService.getAll();
  const map = new Map<number, string>();
  if (prodRes.data) prodRes.data.forEach(p => map.set(p.id, p.product_name));

  list.innerHTML = res.data.map(e => `
    <div class="flex items-center justify-between py-1.5 border-b border-slate-100 text-caption">
      <span class="text-muted w-16">${e.effective_date || ''}</span>
      <span class="font-semibold flex-1">${map.get(e.product_id ?? 0) || '?'}</span>
      <span class="font-bold text-primary">₹${e.retail_price ?? 0}</span>
    </div>
  `).join('');
}
