/**
 * history.ts — Sales history: last 14 days summary cards.
 */

import { AppState, formatCurrency } from '@/lib/state';
import { inventoryService } from '@/services';

export async function renderHistory(): Promise<void> {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '<div class="text-center py-8 text-base-content/50">Loading...</div>';

  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    days.push(AppState.shiftDate(AppState.todayKey(), -i));
  }

  list.innerHTML = '';
  let hasData = false;

  for (const dateKey of days) {
    const res = await inventoryService.getFullDailySummary(dateKey);
    if (!res.data || (res.data.total_revenue === 0 && res.data.products.every(p => p.received === 0))) continue;
    hasData = true;

    const s = res.data;
    const display = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short'
    });

    const card = document.createElement('div');
    card.className = 'collapse collapse-arrow bg-base-100 border border-base-300 rounded-xl';
    card.innerHTML = `
      <input type="checkbox" />
      <div class="collapse-title flex justify-between items-center pr-10">
        <span class="font-bold text-sm">${display}</span>
        <span class="text-sm font-bold text-success">${formatCurrency(s.total_revenue)}</span>
      </div>
      <div class="collapse-content">
        <div class="space-y-1 text-xs">
          ${s.products.filter(p => p.sold > 0 || p.received > 0).map(p => `
            <div class="flex justify-between py-1 border-b border-base-200 last:border-0">
              <span>${p.product_name}</span>
              <span class="text-base-content/60">Recd ${p.received} · Sold ${p.sold}</span>
              <span class="font-bold text-success">${formatCurrency(p.sold * p.retail_price)}</span>
            </div>
          `).join('')}
          <div class="flex justify-between pt-2 font-bold text-sm border-t border-base-300">
            <span>Profit</span>
            <span class="text-success">${formatCurrency(s.total_profit)}</span>
          </div>
        </div>
      </div>
    `;
    list.appendChild(card);
  }

  if (!hasData) {
    list.innerHTML = '<div class="text-center py-12 text-base-content/50">No history yet. Start recording stock & sales.</div>';
  }
}
