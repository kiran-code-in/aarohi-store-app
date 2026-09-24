/**
 * main.ts — App bootstrap. Dashboard-first, compact UI.
 */

import './styles/app.css';
import { onConnectivityChange } from './lib/supabase';
import { isDemoMode } from './lib/demo-data';
import { isSignedIn, signIn, signOut, onAuthChange } from './lib/auth';
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
import { inventoryService, customerNotesService, advanceOrderService } from './services';

type PageId = 'home' | 'stock' | 'sales' | 'wholesale' | 'scan' | 'history' | 'prices' | 'advances' | 'more';

function navigateTo(page: PageId): void {
  document.querySelectorAll<HTMLElement>('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  // Scroll to top
  document.querySelector('main')?.scrollTo(0, 0);

  // Bottom nav highlight — which bottom-nav button lights up for each page
  const navMap: Record<string, string> = {
    home: 'home', stock: 'stock', sales: 'sales', wholesale: 'wholesale',
    scan: 'stock',
    // Reports, Prices, Advances live under the "More" menu
    more: 'more', history: 'more', prices: 'more', advances: 'more',
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
    case 'more': break; // static menu page
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
  set('dashStock', String(s.products.reduce((a, p) => a + p.available, 0)));

  // Today's top sellers
  const salesDiv = document.getElementById('dashTodaySales');
  if (salesDiv) {
    const sold = s.products.filter(p => p.sold > 0).sort((a, b) => b.sold - a.sold);
    salesDiv.innerHTML = sold.length === 0
      ? '<div style="padding:14px 16px;color:#64748B;font-size:13px;text-align:center">No sales recorded yet today</div>'
      : sold.map(p => {
          // Revenue at the prices actually charged, summed from each
          // transaction's snapshot — NOT recomputed from the current price list.
          const value = p.revenue;
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
    // Flag anything low on available stock — but only products that have ever
    // had activity (opening carried, received or sold today).
    const low = s.products.filter(p => p.available >= 0 && p.available <= 3 && (p.opening > 0 || p.received > 0 || p.sold > 0));
    lowDiv.innerHTML = low.length === 0
      ? '<div style="padding:14px 16px;color:#64748B;font-size:13px;text-align:center">All items well stocked</div>'
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
      balDiv.innerHTML = '<div style="padding:14px 16px;color:#64748B;font-size:13px;text-align:center">No outstanding balances</div>';
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

  // Prepare for tomorrow — advance orders due the day after the viewed date
  const tomDiv = document.getElementById('dashTomorrow');
  if (tomDiv) {
    const tomorrow = AppState.shiftDate(AppState.getDate(), 1);
    const advRes = await advanceOrderService.list('pending');
    const due = (advRes.data || []).filter(o => o.requested_date === tomorrow);
    if (due.length === 0) {
      tomDiv.innerHTML = '<div style="padding:14px 16px;color:#64748B;font-size:13px;text-align:center">No advance orders for tomorrow</div>';
    } else {
      tomDiv.innerHTML = due.map(o => {
        const items = o.items.map(i => `${i.quantity}× ${i.product_name}`).join(', ');
        return `
          <div class="product-row" style="align-items:flex-start">
            <div class="info">
              <span class="name">${o.customer_name}</span>
              <span class="meta" style="white-space:normal">${items}</span>
            </div>
            <span style="font-size:11px;font-weight:700;color:#D97706;background:#FEF3C7;padding:3px 8px;border-radius:20px;white-space:nowrap">${o.requested_date}</span>
          </div>`;
      }).join('');
    }
  }
}

let appStarted = false;

async function startApp(): Promise<void> {
  if (appStarted) return;      // wire everything only once
  appStarted = true;

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

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await signOut();
    showLogin();
  });

  // Bottom nav
  document.querySelectorAll<HTMLElement>('.bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page as PageId));
  });

  // Activate on Enter/Space for role="button" elements that aren't <button>
  const keyActivate = (el: HTMLElement, fn: () => void) => {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === 'Enter' || k === ' ') { e.preventDefault(); fn(); }
    });
  };

  // Dashboard action cards + quick buttons
  document.querySelectorAll<HTMLElement>('[data-goto]').forEach(el => {
    keyActivate(el, () => navigateTo(el.dataset.goto as PageId));
  });

  // Back buttons
  document.querySelectorAll<HTMLElement>('[data-back]').forEach(btn => {
    keyActivate(btn, () => navigateTo('home'));
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

// ── Auth gate ────────────────────────────────────────────────────
function showLogin(): void {
  document.getElementById('loginScreen')?.removeAttribute('hidden');
  document.getElementById('appShell')?.setAttribute('hidden', '');
  const err = document.getElementById('loginError');
  if (err) err.textContent = '';
  (document.getElementById('loginForm') as HTMLFormElement | null)?.reset();
}

async function showApp(): Promise<void> {
  document.getElementById('loginScreen')?.setAttribute('hidden', '');
  document.getElementById('appShell')?.removeAttribute('hidden');
  await startApp();
  navigateTo('home');
}

function initLoginForm(): void {
  const form = document.getElementById('loginForm') as HTMLFormElement | null;
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailEl = document.getElementById('loginEmail') as HTMLInputElement;
    const passEl = document.getElementById('loginPassword') as HTMLInputElement;
    const btn = document.getElementById('loginBtn') as HTMLButtonElement;
    const errEl = document.getElementById('loginError');

    if (errEl) errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const err = await signIn(emailEl.value, passEl.value);

    btn.disabled = false;
    btn.textContent = 'Sign In';
    if (err) {
      if (errEl) errEl.textContent = err;
      return;
    }
    await showApp();
  });
}

async function boot(): Promise<void> {
  initLoginForm();

  // React to sign-out happening elsewhere (e.g. token expiry)
  onAuthChange((signedIn) => {
    if (!signedIn) showLogin();
  });

  // Demo mode bypasses auth entirely (local test data only)
  if (isDemoMode() || (await isSignedIn())) {
    await showApp();
  } else {
    showLogin();
  }
}

document.addEventListener('DOMContentLoaded', boot);
