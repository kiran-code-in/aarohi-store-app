'use strict';

/**
 * app.js — Bootstrap, navigation, date helpers, shared utilities.
 * No business logic here — just wiring things together.
 */

const App = (() => {
  let currentDate = '';

  // ── Date helpers ──
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function fmtDisplay(key) {
    const [y, m, d] = key.split('-');
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function shiftDate(key, days) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }

  // ── Day data ──
  function emptyInv() {
    return { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0, manualSold: 0 };
  }

  function emptyDay(dateKey) {
    const yesterday = shiftDate(dateKey, -1);
    const prev = Storage.loadDay(yesterday);
    const inventory = {};
    Data.getProducts().forEach(p => {
      const yRemaining = prev ? (prev.inventory[p.id]?.totalAvailable ?? 0) : 0;
      const inv = emptyInv();
      inv.yesterdayRemaining = yRemaining;
      inv.totalAvailable = yRemaining;
      inventory[p.id] = inv;
    });
    return { dateKey, inventory, wholesale: [], retail: {} };
  }

  function getDay() {
    return Storage.loadDay(currentDate) || emptyDay(currentDate);
  }

  function recalcInventory(day) {
    Data.getProducts().forEach(p => {
      const inv = day.inventory[p.id];
      if (!inv) return;
      inv.totalAvailable = (inv.received + inv.yesterdayRemaining) - inv.soldToday - inv.damaged;
      if (inv.totalAvailable < 0) inv.totalAvailable = 0;
    });
  }

  function syncSoldTotals(day) {
    Data.getProducts().forEach(p => {
      if (!day.inventory[p.id]) day.inventory[p.id] = emptyInv();
      let wsSold = 0;
      day.wholesale.forEach(c => { wsSold += (c.products[p.id] || 0); });
      const retailQty = day.retail[p.id] || 0;
      const manualSold = day.inventory[p.id].manualSold || 0;
      day.inventory[p.id].soldToday = wsSold + retailQty + manualSold;
    });
    recalcInventory(day);
  }

  // ── Format ──
  function fmt(n) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function showToast(msg) {
    const t = document.getElementById('saveToast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ── Navigation ──
  function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    const navBtn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (pageId === 'inventory') Inventory.render();
    if (pageId === 'scan')      Scan.init();
    if (pageId === 'wholesale') Wholesale.render();
    if (pageId === 'retail')    Retail.render();
    if (pageId === 'history')   History.render();
    if (pageId === 'prices')    PricesPage.render();

    if (pageId !== 'scan') Scan.stopCamera();
  }

  function renderHeader() {
    document.getElementById('headerDate').textContent = fmtDisplay(currentDate);
    document.getElementById('nextDayBtn').disabled = currentDate >= todayKey();
  }

  // ── Boot ──
  async function boot() {
    currentDate = todayKey();
    await Data.init();

    // Fetch latest data from Google Sheet (background, non-blocking)
    SheetsSync.fetchSheet().then(sheetData => {
      if (sheetData) {
        console.log('Sheet data synced:', sheetData.fetchedAt || 'from cache');
      }
    });

    renderHeader();
    Inventory.render();

    // Date nav
    document.getElementById('prevDayBtn').addEventListener('click', () => {
      currentDate = shiftDate(currentDate, -1);
      renderHeader();
      navigateTo('inventory');
    });
    document.getElementById('nextDayBtn').addEventListener('click', () => {
      if (currentDate >= todayKey()) return;
      currentDate = shiftDate(currentDate, 1);
      renderHeader();
      navigateTo('inventory');
    });
    document.getElementById('todayBtn').addEventListener('click', () => {
      currentDate = todayKey();
      renderHeader();
      navigateTo('inventory');
    });

    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // Scan page buttons
    document.getElementById('startScanBtn').addEventListener('click', Scan.startCamera);
    document.getElementById('stopScanBtn').addEventListener('click', Scan.stopCamera);
    document.getElementById('applyCountBtn').addEventListener('click', Scan.applyCount);
    document.getElementById('qtyMinus').addEventListener('click', () => {
      const inp = document.getElementById('qtyInput');
      inp.value = Math.max(1, parseInt(inp.value) - 1);
    });
    document.getElementById('qtyPlus').addEventListener('click', () => {
      const inp = document.getElementById('qtyInput');
      inp.value = parseInt(inp.value) + 1;
    });
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Scan.setType(btn.dataset.type);
      });
    });

    // Wholesale modal
    document.getElementById('addCustomerBtn').addEventListener('click', () => {
      document.getElementById('customerNameInput').value = '';
      document.getElementById('addCustomerModal').classList.add('open');
      setTimeout(() => document.getElementById('customerNameInput').focus(), 100);
    });
    document.getElementById('cancelCustomerBtn').addEventListener('click', () => {
      document.getElementById('addCustomerModal').classList.remove('open');
    });
    document.getElementById('confirmCustomerBtn').addEventListener('click', Wholesale.addCustomerFromModal);
    document.getElementById('customerNameInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') Wholesale.addCustomerFromModal();
    });
    document.getElementById('addCustomerModal').addEventListener('click', e => {
      if (e.target === document.getElementById('addCustomerModal'))
        document.getElementById('addCustomerModal').classList.remove('open');
    });

    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  return {
    boot, todayKey, fmtDisplay, fmt, showToast,
    getDay, emptyInv, recalcInventory, syncSoldTotals, navigateTo,
    getCurrentDate: () => currentDate,
  };
})();

// Start the app
document.addEventListener('DOMContentLoaded', () => App.boot());
