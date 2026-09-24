/**
 * prices.ts — Compact price table for fast editing.
 */

import { productService, priceService } from '@/services';
import { showToast } from '@/components/toast';

// Bound ONCE on the persistent tbody. This listener used to be registered
// inside renderPrices(), so every visit to the page stacked another copy and a
// single edit fired several saves — visible in product_prices as duplicate rows
// milliseconds apart.
let listenersBound = false;

export async function renderPrices(): Promise<void> {
  const tbody = document.getElementById('priceTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#64748B;font-size:13px">Loading...</td></tr>';

  const prodRes = await productService.getActive();
  if (!prodRes.data) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#64748B;font-size:13px">Failed to load</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  let currentCat = '';
  let currentType = '';

  prodRes.data.forEach(p => {
    const catName = (p as unknown as { category_name: string }).category_name || '';
    if (catName !== currentCat) {
      currentCat = catName;
      currentType = '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0F766E;padding:14px 8px 4px">${catName}</td>`;
      tbody.appendChild(tr);
    }

    // Product type sub-header (e.g. Cup, Small Cone, Family Pack)
    const pType = p.product_type || '';
    if (pType && pType !== currentType) {
      currentType = pType;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="font-size:10px;font-weight:600;color:#64748B;padding:6px 8px 2px 12px">${pType}</td>`;
      tbody.appendChild(tr);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600;font-size:13px;color:#0F172A">${p.product_name}</td>
      <td><input type="number" data-id="${p.id}" data-field="purchase_price" value="${p.purchase_price ?? 0}" data-original="${p.purchase_price ?? 0}" step="0.5" /></td>
      <td><input type="number" data-id="${p.id}" data-field="retail_price" value="${p.retail_price ?? 0}" data-original="${p.retail_price ?? 0}" step="0.5" /></td>
      <td><input type="number" data-id="${p.id}" data-field="wholesale_price" value="${p.wholesale_price ?? 0}" data-original="${p.wholesale_price ?? 0}" step="0.5" /></td>
    `;
    tbody.appendChild(tr);
  });

  bindPriceSave(tbody);
  await renderPriceHistory();
}

function bindPriceSave(tbody: HTMLElement): void {
  if (listenersBound) return;

  tbody.addEventListener('change', async (e) => {
    const inp = e.target as HTMLInputElement;
    if (!inp.dataset.id) return;

    const val = parseFloat(inp.value) || 0;
    const original = parseFloat(inp.dataset.original ?? '') || 0;

    // Skip no-op saves. Each save appends a product_prices row, so blurring a
    // field you did not actually change used to record a phantom price change.
    if (val === original) return;

    const id = parseInt(inp.dataset.id);
    const field = inp.dataset.field!;

    const prices: Record<string, number> = {};
    prices[field] = val;
    const res = await priceService.updatePrice(
      id,
      prices as { purchase_price?: number; retail_price?: number; wholesale_price?: number }
    );

    if (res.error) {
      showToast(res.error.displayMessage);
      inp.value = String(original); // keep the field honest about what is stored
      return;
    }

    inp.dataset.original = String(val);
    showToast('Saved');
    await renderPriceHistory();
  });

  listenersBound = true;
}

async function renderPriceHistory(): Promise<void> {
  const list = document.getElementById('priceHistoryList');
  if (!list) return;
  const res = await priceService.getAllPriceHistory(15);
  if (!res.data || res.data.length === 0) {
    list.innerHTML = '<div style="color:#64748B;font-size:13px;padding:12px 0">No changes yet</div>';
    return;
  }
  const prodRes = await productService.getAll();
  const map = new Map<number, string>();
  if (prodRes.data) prodRes.data.forEach(p => map.set(p.id, p.product_name));

  list.innerHTML = res.data.map(e => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F8FAFC;font-size:12px">
      <span style="color:#64748B;width:70px">${e.effective_date || ''}</span>
      <span style="font-weight:600;flex:1;color:#334155">${map.get(e.product_id ?? 0) || '?'}</span>
      <span style="font-weight:700;color:#0F766E">₹${e.retail_price ?? 0}</span>
    </div>
  `).join('');
}
