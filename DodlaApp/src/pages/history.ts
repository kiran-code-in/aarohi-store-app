/**
 * history.ts — Sales history: last 14 days, expandable cards.
 */

import { AppState, formatCurrency } from '@/lib/state';
import { inventoryService } from '@/services';

export async function renderHistory(): Promise<void> {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '<div class="text-center py-8 text-muted text-caption">Loading...</div>';

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
    card.className = 'history-card';
    card.innerHTML = `
      <div class="head" data-key="${dateKey}">
        <span class="date">${display}</span>
        <span class="total">${formatCurrency(s.total_revenue)}</span>
      </div>
      <div class="body" id="hist_${dateKey}">
        ${s.products.filter(p => p.sold > 0 || p.received > 0).map(p => `
          <div class="flex justify-between items-center py-1 border-b border-slate-50 text-caption">
            <span class="text-slate-700">${p.product_name}</span>
            <span class="text-muted">R:${p.received} S:${p.sold} D:${p.damaged}</span>
            <span class="font-bold text-emerald-600">${formatCurrency(p.sold * p.retail_price)}</span>
          </div>
        `).join('')}
        <div class="flex justify-between pt-2 mt-1 border-t border-slate-200 text-body font-bold">
          <span>Profit</span>
          <span class="text-emerald-600">${formatCurrency(s.total_profit)}</span>
        </div>
      </div>
    `;
    list.appendChild(card);
  }

  if (!hasData) {
    list.innerHTML = '<div class="text-center py-12 text-muted text-caption">No history yet. Start recording stock & sales.</div>';
  }

  // Toggle
  list.querySelectorAll<HTMLElement>('.head').forEach(h => {
    h.addEventListener('click', () => {
      const body = document.getElementById(`hist_${h.dataset.key}`);
      if (body) body.classList.toggle('open');
    });
  });
}
