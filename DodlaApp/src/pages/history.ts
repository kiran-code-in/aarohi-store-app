/**
 * history.ts — Sales history: last 14 days, expandable cards.
 */

import { AppState, formatCurrency } from '@/lib/state';
import { inventoryService } from '@/services';

export async function renderHistory(): Promise<void> {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:32px;color:#94A3B8;font-size:13px">Loading...</div>';

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
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #F8FAFC;font-size:12px">
            <span style="color:#334155;font-weight:600;flex:1">${p.product_name}</span>
            <span style="color:#94A3B8;font-size:11px">R:${p.received} · S:${p.sold} · D:${p.damaged}</span>
            <span style="font-weight:700;color:#0F766E;width:64px;text-align:right">${formatCurrency(p.sold_retail * p.retail_price + p.sold_wholesale * p.wholesale_price)}</span>
          </div>
        `).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:8px;margin-top:4px;border-top:1px solid #F1F5F9;font-size:14px;font-weight:800">
          <span>Profit</span>
          <span style="color:#0F766E">${formatCurrency(s.total_profit)}</span>
        </div>
      </div>
    `;
    list.appendChild(card);
  }

  if (!hasData) {
    list.innerHTML = '<div style="text-align:center;padding:48px 16px;color:#94A3B8;font-size:13px">No history yet.<br>Start recording stock & sales.</div>';
  }

  // Toggle
  list.querySelectorAll<HTMLElement>('.head').forEach(h => {
    h.addEventListener('click', () => {
      const body = document.getElementById(`hist_${h.dataset.key}`);
      if (body) body.classList.toggle('open');
    });
  });
}
