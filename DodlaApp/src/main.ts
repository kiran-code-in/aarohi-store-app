/**
 * main.ts — App bootstrap. Dashboard-first, compact UI.
 */

import './styles/app.css';
import { onConnectivityChange } from './lib/supabase';
import { AppState, formatCurrency } from './lib/state';
import { renderHeader, initHeaderNav } from './components/header';
import { showToast } from './components/toast';
import { renderInventory } from './pages/inventory';
import { renderWholesale, initWholesaleModal } from './pages/wholesale';
import { renderRetail } from './pages/retail';
import { initScan, initScanEvents, stopCamera } from './pages/scan';
import { renderHistory } from './pages/history';
import { renderPrices } from './pages/prices';
import { inventoryService } from './services';

type PageId = 'home' | 'stock' | 'sales' | 'wholesale' | 'scan' | 'history' | 'prices';

function navigateTo(page: PageId): void {
  document.querySelectorAll<HTMLElement>('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  // Scroll to top
  document.querySelector('main')?.scrollTo(0, 0);

  // Bottom nav highlight
  const navMap: Record<string, string> = {
    home: 'home', stock: 'stock', sales: 'sales',
    wholesale: 'sales', scan: 'stock', history: 'history', prices: 'prices',
  };
  const navTarget = navMap[page] || 'home';
  document.querySelectorAll<HTMLElement>('.bottom-nav button').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector<HTMLElement>(`.bottom-nav button[data-page="${navTarget}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Render
  switch (page) {
    case 'home': renderDashboard(); break;
    case 'stock': renderInventory(); break;
    case 'sales': renderRetail(); break;
    case 'wholesale': renderWholesale(); break;
    case 'scan': initScan(); break;
    case 'history': renderHistory(); break;
    case 'prices': renderPrices(); break;
  }
  if (page !== 'scan') stopCamera();
}

async function renderDashboard(): Promise<void> {
  const res = await inventoryService.getFullDailySummary(AppState.getDate());
  if (!res.data) return;
  const s = res.data;
  const set = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dashRevenue', formatCurrency(s.total_revenue));
  set('dashProfit', formatCurrency(s.total_profit));
  set('dashSold', String(s.products.reduce((a, p) => a + p.sold, 0)));
  set('dashDamaged', String(s.products.reduce((a, p) => a + p.damaged, 0)));

  // Today's top sellers
  const salesDiv = document.getElementById('dashTodaySales');
  if (salesDiv) {
    const sold = s.products.filter(p => p.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 5);
    salesDiv.innerHTML = sold.length === 0
      ? '<div class="text-caption text-muted py-2">No sales yet today</div>'
      : sold.map(p => `<div class="product-row"><div class="info"><span class="name">${p.product_name}</span></div><span class="text-body font-bold text-emerald-600">${p.sold} × ₹${p.retail_price}</span></div>`).join('');
  }
}

async function boot(): Promise<void> {
  renderHeader();
  initHeaderNav(() => navigateTo('home'));

  // Bottom nav
  document.querySelectorAll<HTMLElement>('.bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page as PageId));
  });

  // Dashboard action cards + quick buttons
  document.querySelectorAll<HTMLElement>('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.goto as PageId));
  });

  // Back buttons
  document.querySelectorAll<HTMLElement>('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo('home'));
  });

  // Scan
  initScanEvents();

  // Wholesale modal
  initWholesaleModal();
  document.getElementById('addCustomerModal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('modal-bg'))
      document.getElementById('addCustomerModal')?.classList.remove('open');
  });

  // Connectivity
  onConnectivityChange((online) => showToast(online ? 'Online' : 'Offline'));

  // Boot
  await renderDashboard();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
