/**
 * main.ts — App bootstrap. Dashboard-first, compact UI.
 */

import './styles/app.css';
import { onConnectivityChange } from './lib/supabase';
import { isDemoMode } from './lib/demo-data';
import { AppState, formatCurrency } from './lib/state';
import { renderHeader, initHeaderNav } from './components/header';
import { showToast } from './components/toast';
import { renderInventory } from './pages/inventory';
import { renderWholesale, initWholesaleModal } from './pages/wholesale';
import { renderRetail } from './pages/retail';
import { initScan, initScanEvents, stopCamera } from './pages/scan';
import { renderHistory } from './pages/history';
import { renderPrices } from './pages/prices';
import { renderAdvances } from './pages/advances';
import { inventoryService, customerNotesService } from './services';

type PageId = 'home' | 'stock' | 'sales' | 'wholesale' | 'scan' | 'history' | 'prices' | 'advances';

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
    advances: 'sales',
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
    case 'advances': renderAdvances(); break;
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
    const sold = s.products.filter(p => p.sold > 0).sort((a, b) => b.sold - a.sold);
    salesDiv.innerHTML = sold.length === 0
      ? '<div style="padding:14px 16px;color:#94A3B8;font-size:13px;text-align:center">No sales recorded yet today</div>'
      : sold.map(p => {
          // Correct value: retail units at retail price + wholesale units at wholesale price
          const value = p.sold_retail * p.retail_price + p.sold_wholesale * p.wholesale_price;
          const breakdown = p.sold_wholesale > 0
            ? `${p.sold} sold (${p.sold_retail} retail, ${p.sold_wholesale} wholesale)`
            : `${p.sold} sold`;
          return `
          <div class="product-row">
            <div class="info">
              <span class="name">${p.product_name}</span>
              <span class="meta">${breakdown}</span>
            </div>
            <span style="font-size:15px;font-weight:800;color:#0F766E">${formatCurrency(value)}</span>
          </div>`;
        }).join('');
  }

  // Low stock alerts
  const lowDiv = document.getElementById('dashLowStock');
  if (lowDiv) {
    // Flag anything low on true (carry-forward) available stock — but only
    // products that have ever had activity (pending, received or sold today).
    const low = s.products.filter(p => p.available >= 0 && p.available <= 3 && (p.pending > 0 || p.received > 0 || p.sold > 0));
    lowDiv.innerHTML = low.length === 0
      ? '<div style="padding:14px 16px;color:#94A3B8;font-size:13px;text-align:center">All items well stocked</div>'
      : low.map(p => `
          <div class="product-row">
            <div class="info"><span class="name">${p.product_name}</span></div>
            <span style="font-size:13px;font-weight:700;color:#DC2626">${p.available} left</span>
          </div>`).join('');
  }

  // Balances due — who needs to pay, most owed first
  const balDiv = document.getElementById('dashBalances');
  if (balDiv) {
    const balRes = await customerNotesService.getAllBalances();
    const owing = (balRes.data || []).filter(b => b.balance > 0);
    if (owing.length === 0) {
      balDiv.innerHTML = '<div style="padding:14px 16px;color:#94A3B8;font-size:13px;text-align:center">No outstanding balances</div>';
    } else {
      const totalDue = owing.reduce((a, b) => a + b.balance, 0);
      balDiv.innerHTML = `
        <div class="product-row" style="background:#FEF2F2">
          <div class="info"><span class="name" style="color:#991B1B">Total outstanding</span></div>
          <span style="font-size:15px;font-weight:800;color:#DC2626">${formatCurrency(totalDue)}</span>
        </div>
        ${owing.map(b => `
          <div class="product-row">
            <div class="info"><span class="name">${b.customer_name}</span></div>
            <span style="font-size:14px;font-weight:800;color:#DC2626">${formatCurrency(b.balance)}</span>
          </div>`).join('')}`;
    }
  }
}

async function boot(): Promise<void> {
  // Demo mode banner
  if (isDemoMode()) {
    const banner = document.createElement('div');
    banner.textContent = '🧪 DEMO MODE — test data only, not saved to database';
    banner.style.cssText = 'background:#F59E0B;color:#fff;font-size:11px;font-weight:700;text-align:center;padding:5px;position:fixed;top:0;left:0;right:0;z-index:999';
    document.body.appendChild(banner);
    const header = document.querySelector('.app-header') as HTMLElement;
    if (header) header.style.marginTop = '24px';
  }

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
