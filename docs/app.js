'use strict';

// ═══════════════════════════════════════════════════════════════
//  PRODUCT CATALOG — organized by category
//  Default prices: buyPrice (cost from supplier), retailPrice (MRP),
//  wholesalePrice (bulk rate). These are defaults — actual prices
//  come from getPrices() which reads localStorage overrides.
// ═══════════════════════════════════════════════════════════════
const PRODUCTS = [
  // ── Milk Products ──                         buy   retail  wholesale
  { id: 'FCM',       name: 'FCM (Full Cream)', category: 'Milk', buyPrice: 35,  retailPrice: 38,  wholesalePrice: 36,  barcodes: ['FCM','FCM1'] },
  { id: 'STD',       name: 'STD (Standard)',   category: 'Milk', buyPrice: 30,  retailPrice: 33,  wholesalePrice: 31,  barcodes: ['STD','STD1'] },
  { id: 'MILK200',   name: 'Milk 200ml',       category: 'Milk', buyPrice: 8,   retailPrice: 9.5, wholesalePrice: 9,   barcodes: ['MILK200','M200'] },
  { id: 'CURD500',   name: 'Curd 500ml',       category: 'Milk', buyPrice: 30,  retailPrice: 34,  wholesalePrice: 32,  barcodes: ['CURD500','C500'] },
  { id: 'CURD200',   name: 'Curd 200ml',       category: 'Milk', buyPrice: 8,   retailPrice: 9.5, wholesalePrice: 9,   barcodes: ['CURD200','C200'] },
  { id: 'CURD10L',   name: 'Curd 10L',         category: 'Milk', buyPrice: 580, retailPrice: 630, wholesalePrice: 600, barcodes: ['CURD10L','C10L'] },
  { id: 'CURD5L',    name: 'Curd 5L',          category: 'Milk', buyPrice: 290, retailPrice: 320, wholesalePrice: 305, barcodes: ['CURD5L','C5L'] },
  { id: 'LUSSI',     name: 'Lussi',            category: 'Milk', buyPrice: 8,   retailPrice: 9.5, wholesalePrice: 9,   barcodes: ['LUSSI'] },
  { id: 'BUTTERMILK',name: 'Butter Milk',      category: 'Milk', buyPrice: 7,   retailPrice: 8.5, wholesalePrice: 8,   barcodes: ['BM','BM1','BUTTERMILK'] },

  // ── Ice Cream ──
  { id: 'IC_CONE',   name: 'Cone',             category: 'Ice Cream', buyPrice: 16, retailPrice: 20,  wholesalePrice: 18,  barcodes: ['CONE'] },
  { id: 'IC_CUP',    name: 'Cup',              category: 'Ice Cream', buyPrice: 24, retailPrice: 30,  wholesalePrice: 27,  barcodes: ['ICCUP'] },
  { id: 'IC_FAMILY', name: 'Family Pack',      category: 'Ice Cream', buyPrice: 95, retailPrice: 120, wholesalePrice: 110, barcodes: ['ICFAM'] },
  { id: 'IC_CANDY',  name: 'Candy/Bar',        category: 'Ice Cream', buyPrice: 12, retailPrice: 15,  wholesalePrice: 13,  barcodes: ['ICBAR'] },
  { id: 'IC_CHOCOBAR',name:'Chocobar',         category: 'Ice Cream', buyPrice: 20, retailPrice: 25,  wholesalePrice: 22,  barcodes: ['CHOCO'] },

  // ── Soft Drinks ──
  { id: 'SD_SMALL',  name: 'Soft Drink 250ml', category: 'Soft Drinks', buyPrice: 16, retailPrice: 20, wholesalePrice: 18, barcodes: ['SD250'] },
  { id: 'SD_MED',    name: 'Soft Drink 500ml', category: 'Soft Drinks', buyPrice: 32, retailPrice: 40, wholesalePrice: 36, barcodes: ['SD500'] },
  { id: 'SD_LARGE',  name: 'Soft Drink 1L',    category: 'Soft Drinks', buyPrice: 56, retailPrice: 70, wholesalePrice: 63, barcodes: ['SD1L'] },
  { id: 'SD_WATER',  name: 'Water Bottle',     category: 'Soft Drinks', buyPrice: 14, retailPrice: 20, wholesalePrice: 17, barcodes: ['WATER'] },
  { id: 'SD_JUICE',  name: 'Juice',            category: 'Soft Drinks', buyPrice: 24, retailPrice: 30, wholesalePrice: 27, barcodes: ['JUICE'] },

  // ── Ready to Cook ──
  { id: 'RC_CHAPATHI',name:'Chapathi',         category: 'Ready to Cook', buyPrice: 32, retailPrice: 40, wholesalePrice: 36, barcodes: ['CHAP'] },
  { id: 'RC_POORI',   name:'Poori',            category: 'Ready to Cook', buyPrice: 32, retailPrice: 40, wholesalePrice: 36, barcodes: ['POORI'] },
  { id: 'RC_PAROTA',  name:'Parota',           category: 'Ready to Cook', buyPrice: 36, retailPrice: 45, wholesalePrice: 40, barcodes: ['PAROTA'] },
  { id: 'RC_IDLY',    name:'Idly Batter',      category: 'Ready to Cook', buyPrice: 48, retailPrice: 60, wholesalePrice: 54, barcodes: ['IDLY'] },
  { id: 'RC_DOSA',    name:'Dosa Batter',      category: 'Ready to Cook', buyPrice: 48, retailPrice: 60, wholesalePrice: 54, barcodes: ['DOSA'] },
];

// Category list (derived)
const CATEGORIES = [...new Set(PRODUCTS.map(p => p.category))];

// ═══════════════════════════════════════════════════════════════
//  PRICING SYSTEM — stored in localStorage, updatable by user
//  Price history tracks every change with date
// ═══════════════════════════════════════════════════════════════
const PRICES_KEY = 'aarohi_prices';
const PRICE_HISTORY_KEY = 'aarohi_price_history';

function loadPrices() {
  const raw = localStorage.getItem(PRICES_KEY);
  return raw ? JSON.parse(raw) : null;
}

function savePrices(prices) {
  localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
}

function loadPriceHistory() {
  const raw = localStorage.getItem(PRICE_HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

function savePriceHistory(history) {
  localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
}

// Get current effective prices for a product (user overrides or defaults)
function getPrices(productId) {
  const stored = loadPrices();
  if (stored && stored[productId]) {
    return stored[productId];
  }
  const p = PRODUCTS.find(x => x.id === productId);
  return { buyPrice: p.buyPrice, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice };
}

// Update a product's price and record history
function updatePrice(productId, field, newValue) {
  const prices = loadPrices() || {};
  const current = getPrices(productId);
  const oldValue = current[field];

  if (!prices[productId]) {
    prices[productId] = { ...current };
  }
  prices[productId][field] = newValue;
  savePrices(prices);

  // Record history
  const history = loadPriceHistory();
  history.unshift({
    productId,
    field,
    oldValue,
    newValue,
    date: todayKey(),
    timestamp: Date.now(),
  });
  // Keep last 200 entries
  if (history.length > 200) history.length = 200;
  savePriceHistory(history);
}

const REGULAR_CUSTOMERS = [
  // From the actual daily sheets in Dodla Dairy Products.xlsx
  'Chendramouli', 'Narayana',    'Laxmana',   'Babu',
  'Pratap',       'Nagaraju',    'Venu',       'Mounika',
  'Malyadri',     'Krishna',     'Ashok',      'Rajesh',
  'Mahesh',       'Ramesh',      'Dinesh',     'Sreenu',
  'Murali',       'Gopal',       'Raju',       'Ramana',
  'Ragaiah',      'Madhu',       'Channaiah',  'Bramhaiah',
  'Kondapa Naidu','Padma',       'Suri',       'Rayudu',
  'Balaiah',      'Sri Hari',    'Kumar',      'Aparna',
  'Mallema',      'Narasimha',   'Raja',       'Gangupenta',
];

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let currentDate = todayKey();          // "YYYY-MM-DD"
let activeScanType = 'received';
let activeCategory = CATEGORIES[0];    // start with first category
let codeReader = null;
let scanActive = false;

// ═══════════════════════════════════════════════════════════════
//  DATE HELPERS
// ═══════════════════════════════════════════════════════════════
function todayKey() {
  const d = new Date();
  return fmtKey(d);
}

function fmtKey(d) {
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
  return fmtKey(dt);
}

// ═══════════════════════════════════════════════════════════════
//  STORAGE  (one record per day)
// ═══════════════════════════════════════════════════════════════
function storageKey(dateKey) { return `aarohi_${dateKey}`; }

function emptyDay(dateKey) {
  const yesterday = shiftDate(dateKey, -1);
  const prev = loadDay(yesterday);
  const inventory = {};
  PRODUCTS.forEach(p => {
    // yesterday's remaining carries forward
    const yRemaining = prev ? (prev.inventory[p.id]?.totalAvailable ?? 0) : 0;
    inventory[p.id] = {
      received: 0,
      yesterdayRemaining: yRemaining,
      soldToday: 0,
      totalAvailable: yRemaining,   // will recalc
      damaged: 0,
      manualSold: 0,
    };
  });
  return {
    dateKey,
    inventory,
    wholesale: [],   // [{name, products:{id:qty}}]
    retail: {},      // {id: qty}
  };
}

function loadDay(dateKey) {
  const raw = localStorage.getItem(storageKey(dateKey));
  return raw ? JSON.parse(raw) : null;
}

function getDay(dateKey) {
  return loadDay(dateKey) || emptyDay(dateKey);
}

function saveDay(day, silent) {
  localStorage.setItem(storageKey(day.dateKey), JSON.stringify(day));
  if (!silent) showToast('Saved');
}

function recalcInventory(day) {
  PRODUCTS.forEach(p => {
    const inv = day.inventory[p.id];
    inv.totalAvailable = (inv.received + inv.yesterdayRemaining) - inv.soldToday - inv.damaged;
    if (inv.totalAvailable < 0) inv.totalAvailable = 0;
  });
}

// ═══════════════════════════════════════════════════════════════
//  BARCODE LOOKUP
// ═══════════════════════════════════════════════════════════════
function findProductByBarcode(code) {
  const c = (code || '').trim().toUpperCase();
  return PRODUCTS.find(p =>
    p.barcodes.some(b => b.toUpperCase() === c)
  ) || null;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER HEADER
// ═══════════════════════════════════════════════════════════════
function renderHeader() {
  document.getElementById('headerDate').textContent = fmtDisplay(currentDate);
  const today = todayKey();
  document.getElementById('nextDayBtn').disabled = currentDate >= today;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER CATEGORY TABS
// ═══════════════════════════════════════════════════════════════
function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  container.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      renderCategoryTabs();
      renderInventory();
    });
    container.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER INVENTORY TABLE (filtered by active category)
// ═══════════════════════════════════════════════════════════════
function renderInventory() {
  const day = getDay(currentDate);
  const tbody = document.getElementById('inventoryBody');
  tbody.innerHTML = '';

  let totalRevenue = 0;
  let totalCost = 0;
  let damagedAmt = 0;

  // Show only products for the selected category
  const filtered = PRODUCTS.filter(p => p.category === activeCategory);

  filtered.forEach(p => {
    const prices = getPrices(p.id);
    const inv = day.inventory[p.id] || { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0 };

    // Revenue = wholesale sold at wholesale price + retail sold at retail price
    // For inventory view, use a blended approach: just show total sold × retail for revenue display
    // Actual profit is calculated from wholesale/retail split in summary
    const wsSold = getWholesaleSoldForProduct(day, p.id);
    const retailSold = (day.retail[p.id] || 0);
    const revenue = (wsSold * prices.wholesalePrice) + (retailSold * prices.retailPrice);
    const cost = inv.soldToday * prices.buyPrice;
    totalRevenue += revenue;
    totalCost += cost;
    damagedAmt += inv.damaged * prices.buyPrice;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-product">${p.name}<span class="product-price">Buy ₹${prices.buyPrice} · Sell ₹${prices.retailPrice}</span></td>
      <td class="col-num">
        <input class="inv-input" type="number" min="0" inputmode="numeric"
               data-id="${p.id}" data-field="received"
               value="${inv.received}" />
      </td>
      <td class="col-num total-cell">${inv.yesterdayRemaining}</td>
      <td class="col-num sold-cell">
        <div class="sold-stepper">
          <button class="sold-btn sold-minus" data-id="${p.id}">−</button>
          <span class="sold-value">${inv.soldToday}</span>
          <button class="sold-btn sold-plus" data-id="${p.id}">+</button>
        </div>
      </td>
      <td class="col-num total-cell">${inv.totalAvailable}</td>
      <td class="col-num">
        <input class="inv-input damaged-cell" type="number" min="0" inputmode="numeric"
               data-id="${p.id}" data-field="damaged"
               value="${inv.damaged}" />
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Total across ALL categories (full day)
  PRODUCTS.forEach(p => {
    if (p.category !== activeCategory) {
      const prices = getPrices(p.id);
      const inv = day.inventory[p.id] || {};
      const wsSold = getWholesaleSoldForProduct(day, p.id);
      const retailSold = (day.retail[p.id] || 0);
      totalRevenue += (wsSold * prices.wholesalePrice) + (retailSold * prices.retailPrice);
      totalCost += (inv.soldToday || 0) * prices.buyPrice;
      damagedAmt += (inv.damaged || 0) * prices.buyPrice;
    }
  });

  const profit = totalRevenue - totalCost;
  document.getElementById('totalRevenue').textContent = fmt(totalRevenue);
  document.getElementById('totalProfit').textContent = fmt(profit);
  document.getElementById('totalDamagedLoss').textContent = fmt(damagedAmt);

  // attach input listeners for received/damaged
  tbody.querySelectorAll('.inv-input').forEach(inp => {
    inp.addEventListener('input', onInventoryChange);
  });

  // attach sold +/- listeners
  tbody.querySelectorAll('.sold-plus').forEach(btn => {
    btn.addEventListener('click', () => onSoldChange(btn.dataset.id, +1));
  });
  tbody.querySelectorAll('.sold-minus').forEach(btn => {
    btn.addEventListener('click', () => onSoldChange(btn.dataset.id, -1));
  });
}

// Helper: get total wholesale sold for a specific product across all customers
function getWholesaleSoldForProduct(day, productId) {
  let total = 0;
  (day.wholesale || []).forEach(c => { total += (c.products[productId] || 0); });
  return total;
}

// Handle +/- on sold column (additive — tracks manual sold separately)
function onSoldChange(productId, delta) {
  const day = getDay(currentDate);
  if (!day.inventory[productId]) day.inventory[productId] = { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0, manualSold: 0 };
  if (!day.inventory[productId].manualSold) day.inventory[productId].manualSold = 0;
  day.inventory[productId].manualSold = Math.max(0, day.inventory[productId].manualSold + delta);
  // Recalc total sold = wholesale + retail + manual
  syncWholesaleToInventory(day);
  saveDay(day);
  renderInventory();
}

let _invRenderTimer = null;
function onInventoryChange(e) {
  const inp = e.target;
  const id = inp.dataset.id;
  const field = inp.dataset.field;
  const val = Math.max(0, parseInt(inp.value) || 0);

  const day = getDay(currentDate);
  if (!day.inventory[id]) day.inventory[id] = { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0, manualSold: 0 };
  day.inventory[id][field] = val;
  recalcInventory(day);
  saveDay(day, true);

  // Debounce the re-render so typing isn't interrupted
  clearTimeout(_invRenderTimer);
  _invRenderTimer = setTimeout(() => renderInventory(), 600);
}

// ═══════════════════════════════════════════════════════════════
//  RENDER WHOLESALE
// ═══════════════════════════════════════════════════════════════
function renderWholesale() {
  const day = getDay(currentDate);
  const list = document.getElementById('wholesaleCustomerList');
  list.innerHTML = '';

  day.wholesale.forEach((cust, idx) => {
    const subtotal = calcCustomerTotal(cust);
    const card = document.createElement('div');
    card.className = 'customer-card';
    card.innerHTML = `
      <div class="customer-header" data-idx="${idx}">
        <span class="customer-name">${cust.name}</span>
        <span class="customer-subtotal">₹${subtotal.toFixed(2)}</span>
        <button class="customer-toggle" data-idx="${idx}" title="Collapse/Expand">▾</button>
      </div>
      <div class="customer-body" id="custBody_${idx}">
        ${CATEGORIES.map(cat => {
          const catProducts = PRODUCTS.filter(p => p.category === cat);
          const hasQty = catProducts.some(p => (cust.products[p.id] || 0) > 0);
          return `
            <div class="ws-cat-group">
              <div class="ws-cat-header" data-cat="${cat}" data-idx="${idx}">${cat}</div>
              <div class="ws-cat-body${hasQty ? ' open' : ''}" id="wsCat_${idx}_${cat.replace(/\s/g,'')}">
                ${catProducts.map(p => {
                  const qty = cust.products[p.id] || 0;
                  const prices = getPrices(p.id);
                  return `
                    <div class="ws-product-row">
                      <span class="ws-product-label">${p.name}</span>
                      <span class="ws-product-price">₹${prices.wholesalePrice}</span>
                      <input class="ws-qty-input" type="number" min="0"
                             data-custidx="${idx}" data-pid="${p.id}"
                             value="${qty}" placeholder="0" />
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>
    `;
    list.appendChild(card);
  });

  // toggle expand/collapse
  list.querySelectorAll('.customer-header').forEach(h => {
    h.addEventListener('click', () => {
      const idx = h.dataset.idx;
      const body = document.getElementById(`custBody_${idx}`);
      body.classList.toggle('open');
      // Update arrow
      const toggle = h.querySelector('.customer-toggle');
      if (toggle) toggle.textContent = body.classList.contains('open') ? '▾' : '▸';
    });
  });

  // input changes — use event delegation on the list container
  list.addEventListener('input', (e) => {
    if (e.target.classList.contains('ws-qty-input')) {
      onWholesaleChange(e);
    }
  });

  // category group toggle inside customer cards
  list.querySelectorAll('.ws-cat-header').forEach(h => {
    h.addEventListener('click', () => {
      const cat = h.dataset.cat;
      const idx = h.dataset.idx;
      const body = document.getElementById(`wsCat_${idx}_${cat.replace(/\s/g,'')}`);
      if (body) body.classList.toggle('open');
    });
  });

  renderWholesaleTotals(day);
  renderQuickAddChips();
}

function calcCustomerTotal(cust) {
  let t = 0;
  PRODUCTS.forEach(p => {
    const prices = getPrices(p.id);
    t += (cust.products[p.id] || 0) * prices.wholesalePrice;
  });
  return t;
}

let _wsRenderTimer = null;
function onWholesaleChange(e) {
  const inp = e.target;
  const idx = parseInt(inp.dataset.custidx);
  const pid = inp.dataset.pid;
  const val = Math.max(0, parseInt(inp.value) || 0);

  const day = getDay(currentDate);
  if (!day.wholesale[idx]) return; // safety check
  if (!day.wholesale[idx].products) day.wholesale[idx].products = {};
  day.wholesale[idx].products[pid] = val;

  // sync wholesale sold into inventory
  syncWholesaleToInventory(day);
  saveDay(day, true);

  // Update subtotal display without full re-render (avoids collapse)
  const headerEl = document.querySelector(`.customer-header[data-idx="${idx}"] .customer-subtotal`);
  if (headerEl) {
    headerEl.textContent = '₹' + calcCustomerTotal(day.wholesale[idx]).toFixed(2);
  }

  clearTimeout(_wsRenderTimer);
  _wsRenderTimer = setTimeout(() => { renderWholesaleTotals(day); renderInventory(); }, 500);
}

function syncWholesaleToInventory(day) {
  // Wholesale + retail contribute to soldToday, but don't reset manual +/- additions
  // soldToday = wholesale total + retail total + manual adjustments
  // We store manual adjustments separately
  PRODUCTS.forEach(p => {
    let wsSold = 0;
    day.wholesale.forEach(c => { wsSold += c.products[p.id] || 0; });
    const retailQty = day.retail[p.id] || 0;
    const manualSold = day.inventory[p.id]?.manualSold || 0;
    day.inventory[p.id].soldToday = wsSold + retailQty + manualSold;
  });
  recalcInventory(day);
}

function renderWholesaleTotals(day) {
  const head = document.getElementById('wholesaleTotalsHead');
  const body = document.getElementById('wholesaleTotalsBody');
  head.innerHTML = '';
  body.innerHTML = '';

  PRODUCTS.forEach(p => {
    const th = document.createElement('th');
    th.textContent = p.name;
    head.appendChild(th);
  });

  PRODUCTS.forEach(p => {
    let total = 0;
    (day.wholesale || []).forEach(c => { total += c.products[p.id] || 0; });
    const td = document.createElement('td');
    td.textContent = total;
    body.appendChild(td);
  });
}

// ═══════════════════════════════════════════════════════════════
//  RENDER RETAIL
// ═══════════════════════════════════════════════════════════════
function renderRetail() {
  const day = getDay(currentDate);
  const tbody = document.getElementById('retailBody');
  tbody.innerHTML = '';

  let totalQty = 0;
  let totalAmt = 0;

  PRODUCTS.forEach(p => {
    const prices = getPrices(p.id);
    const qty = day.retail[p.id] || 0;
    const amt = qty * prices.retailPrice;
    totalQty += qty;
    totalAmt += amt;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-product">${p.name}<br><small style="color:var(--text-sec)">₹${prices.retailPrice}/unit</small></td>
      <td class="col-num">
        <input class="inv-input" type="number" min="0"
               data-id="${p.id}"
               value="${qty}" />
      </td>
      <td class="col-num">₹${amt.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('retailTotalQty').textContent = totalQty;
  document.getElementById('retailTotalAmt').textContent = fmt(totalAmt);

  tbody.querySelectorAll('.inv-input').forEach(inp => {
    inp.addEventListener('input', onRetailChange);
  });
}

let _retailRenderTimer = null;
function onRetailChange(e) {
  const inp = e.target;
  const id = inp.dataset.id;
  const val = Math.max(0, parseInt(inp.value) || 0);

  const day = getDay(currentDate);
  if (!day.retail) day.retail = {};
  day.retail[id] = val;
  syncWholesaleToInventory(day);
  saveDay(day, true);

  clearTimeout(_retailRenderTimer);
  _retailRenderTimer = setTimeout(() => { renderRetail(); renderInventory(); }, 600);
}

// ═══════════════════════════════════════════════════════════════
//  RENDER HISTORY
// ═══════════════════════════════════════════════════════════════
function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';

  // gather all saved day keys
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('aarohi_')) keys.push(k.replace('aarohi_', ''));
  }
  keys.sort((a, b) => b.localeCompare(a)); // newest first

  if (keys.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:#999;padding:30px">No history yet.<br>Start entering daily data.</p>';
    return;
  }

  keys.forEach(dateKey => {
    const day = loadDay(dateKey);
    if (!day) return;
    let totalAmt = 0;
    PRODUCTS.forEach(p => {
      const prices = getPrices(p.id);
      totalAmt += (day.inventory[p.id]?.soldToday || 0) * prices.retailPrice;
    });

    const div = document.createElement('div');
    div.className = 'history-day';
    div.innerHTML = `
      <div class="history-day-header" data-key="${dateKey}">
        <span class="history-day-date">${fmtDisplay(dateKey)}</span>
        <span class="history-day-total">${fmt(totalAmt)}</span>
      </div>
      <div class="history-day-body" id="hist_${dateKey}">
        ${PRODUCTS.map(p => {
          const inv = day.inventory[p.id] || {};
          return `<div class="history-row">
            <span>${p.name}</span>
            <span>Recd: ${inv.received || 0} | Sold: ${inv.soldToday || 0} | Dmg: ${inv.damaged || 0}</span>
            <span style="color:var(--green)">₹${((inv.soldToday || 0) * getPrices(p.id).retailPrice).toFixed(2)}</span>
          </div>`;
        }).join('')}
        <div class="history-row" style="margin-top:6px;font-weight:700">
          <span>Total Earnings</span>
          <span></span>
          <span style="color:var(--green)">${fmt(totalAmt)}</span>
        </div>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll('.history-day-header').forEach(h => {
    h.addEventListener('click', () => {
      const body = document.getElementById(`hist_${h.dataset.key}`);
      body.classList.toggle('open');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
//  SCAN PAGE LOGIC
// ═══════════════════════════════════════════════════════════════
function initScanPage() {
  const select = document.getElementById('scanProductSelect');
  if (select.options.length <= 1) {
    CATEGORIES.forEach(cat => {
      const grp = document.createElement('optgroup');
      grp.label = cat;
      PRODUCTS.filter(p => p.category === cat).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const prices = getPrices(p.id);
        opt.textContent = `${p.name}  (₹${prices.retailPrice})`;
        grp.appendChild(opt);
      });
      select.appendChild(grp);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  CUSTOMER SEARCH + SELECT LIST (replaces chips for scalability)
// ═══════════════════════════════════════════════════════════════
function renderQuickAddChips() {
  renderCustomerList('');
  const searchInput = document.getElementById('customerSearchInput');
  // Remove old listener by replacing node
  const newInput = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newInput, searchInput);
  newInput.addEventListener('input', (e) => {
    renderCustomerList(e.target.value.trim().toLowerCase());
  });
}

function renderCustomerList(filter) {
  const day = getDay(currentDate);
  const container = document.getElementById('customerListScroll');
  container.innerHTML = '';

  const filtered = REGULAR_CUSTOMERS.filter(name =>
    !filter || name.toLowerCase().includes(filter)
  );

  if (filtered.length === 0 && filter) {
    container.innerHTML = `<div class="cl-empty">No match. Use "＋ Add New" below.</div>`;
    return;
  }

  filtered.forEach(name => {
    const alreadyAdded = day.wholesale.some(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    const row = document.createElement('div');
    row.className = 'cl-row' + (alreadyAdded ? ' cl-added' : '');
    row.innerHTML = `
      <span class="cl-name">${name}</span>
      <span class="cl-status">${alreadyAdded ? '✓ Added' : 'Tap to add'}</span>
    `;
    if (!alreadyAdded) {
      row.addEventListener('click', () => {
        addCustomerByName(name);
        renderCustomerList(document.getElementById('customerSearchInput').value.trim().toLowerCase());
      });
    }
    container.appendChild(row);
  });
}

function applyScanCount() {
  const pid = document.getElementById('scanProductSelect').value;
  const qty = parseInt(document.getElementById('qtyInput').value) || 0;
  const feedback = document.getElementById('scanFeedback');

  if (!pid) { showFeedback('Please select a product', false); return; }
  if (qty <= 0) { showFeedback('Enter a quantity > 0', false); return; }

  const day = getDay(currentDate);
  const inv = day.inventory[pid] || { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0 };

  const product = PRODUCTS.find(p => p.id === pid);

  if (activeScanType === 'received') {
    inv.received += qty;
  } else if (activeScanType === 'sold') {
    inv.soldToday += qty;
  } else if (activeScanType === 'damaged') {
    inv.damaged += qty;
  }

  day.inventory[pid] = inv;
  recalcInventory(day);
  saveDay(day);
  renderInventory();
  renderRetail();

  showFeedback(`✓ ${product.name} — ${qty} units (${activeScanType}) applied`, true);
  document.getElementById('qtyInput').value = 1;
}

function showFeedback(msg, ok) {
  const el = document.getElementById('scanFeedback');
  el.textContent = msg;
  el.className = 'scan-feedback ' + (ok ? 'success' : 'error');
  setTimeout(() => { el.className = 'scan-feedback'; }, 3000);
}

// Camera barcode scanning
async function startCameraScan() {
  if (typeof ZXing === 'undefined') {
    showFeedback('Barcode library not loaded. Use manual mode.', false);
    return;
  }
  try {
    const hints = new Map();
    codeReader = new ZXing.BrowserMultiFormatReader(hints);
    const box = document.getElementById('scannerBox');
    const video = document.getElementById('scannerVideo');
    box.classList.add('active');
    document.getElementById('startScanBtn').style.display = 'none';
    document.getElementById('stopScanBtn').style.display = 'block';
    scanActive = true;

    const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
    const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[devices.length - 1];
    const deviceId = backCamera ? backCamera.deviceId : undefined;

    codeReader.decodeFromVideoDevice(deviceId, video, (result, err) => {
      if (result && scanActive) {
        const code = result.getText();
        handleScanResult(code);
      }
    });
  } catch (err) {
    showFeedback('Camera error: ' + err.message, false);
    stopCameraScan();
  }
}

function stopCameraScan() {
  scanActive = false;
  if (codeReader) { codeReader.reset(); codeReader = null; }
  document.getElementById('scannerBox').classList.remove('active');
  document.getElementById('startScanBtn').style.display = 'block';
  document.getElementById('stopScanBtn').style.display = 'none';
}

function handleScanResult(code) {
  const product = findProductByBarcode(code);
  if (product) {
    stopCameraScan();
    document.getElementById('scanProductSelect').value = product.id;
    showFeedback(`Scanned: ${product.name} — set quantity and press Apply`, true);
  } else {
    showFeedback(`Unknown barcode: ${code}. Select manually.`, false);
  }
}

// ═══════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`page-${pageId}`).classList.add('active');
  document.querySelector(`.nav-btn[data-page="${pageId}"]`).classList.add('active');

  if (pageId === 'inventory') { renderCategoryTabs(); renderInventory(); }
  if (pageId === 'scan')      initScanPage();
  if (pageId === 'wholesale') { renderWholesale(); renderQuickAddChips(); }
  if (pageId === 'retail')    renderRetail();
  if (pageId === 'history')   renderHistory();
  if (pageId === 'prices')    renderPrices();

  if (pageId !== 'scan') stopCameraScan();
}

// ═══════════════════════════════════════════════════════════════
//  ADD CUSTOMER MODAL
// ═══════════════════════════════════════════════════════════════
function addCustomerByName(name) {
  const day = getDay(currentDate);
  if (day.wholesale.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast(`${name} already added`);
    return;
  }
  // Add new customer at the TOP of the list so they appear first
  day.wholesale.unshift({ name, products: {} });
  saveDay(day, true);

  renderWholesale();

  // Collapse all cards, then expand only the new one (first card)
  setTimeout(() => {
    document.querySelectorAll('.customer-body').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.customer-toggle').forEach(t => t.textContent = '▸');
    const newBody = document.getElementById('custBody_0');
    if (newBody) {
      newBody.classList.add('open');
      const toggle = document.querySelector('.customer-header[data-idx="0"] .customer-toggle');
      if (toggle) toggle.textContent = '▾';
      // Scroll to top of customer list
      newBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
}

function openAddCustomerModal() {
  document.getElementById('customerNameInput').value = '';
  document.getElementById('addCustomerModal').classList.add('open');
  setTimeout(() => document.getElementById('customerNameInput').focus(), 100);
}

function closeAddCustomerModal() {
  document.getElementById('addCustomerModal').classList.remove('open');
}

function confirmAddCustomer() {
  const name = document.getElementById('customerNameInput').value.trim();
  if (!name) return;
  addCustomerByName(name);
  closeAddCustomerModal();
}

// ═══════════════════════════════════════════════════════════════
//  RENDER PRICES PAGE
// ═══════════════════════════════════════════════════════════════
function renderPrices() {
  const container = document.getElementById('pricesBody');
  container.innerHTML = '';

  let currentCat = '';
  PRODUCTS.forEach(p => {
    if (p.category !== currentCat) {
      currentCat = p.category;
      const catDiv = document.createElement('div');
      catDiv.className = 'price-category-header';
      catDiv.textContent = currentCat;
      container.appendChild(catDiv);
    }

    const prices = getPrices(p.id);
    const row = document.createElement('div');
    row.className = 'price-row';
    row.innerHTML = `
      <div class="price-product-name">${p.name}</div>
      <div class="price-inputs">
        <div class="price-field">
          <label>Buy</label>
          <input type="number" class="price-input" data-id="${p.id}" data-field="buyPrice"
                 value="${prices.buyPrice}" inputmode="decimal" step="0.5" />
        </div>
        <div class="price-field">
          <label>Retail</label>
          <input type="number" class="price-input" data-id="${p.id}" data-field="retailPrice"
                 value="${prices.retailPrice}" inputmode="decimal" step="0.5" />
        </div>
        <div class="price-field">
          <label>Wholesale</label>
          <input type="number" class="price-input" data-id="${p.id}" data-field="wholesalePrice"
                 value="${prices.wholesalePrice}" inputmode="decimal" step="0.5" />
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  // Attach change listeners
  container.querySelectorAll('.price-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const val = parseFloat(e.target.value) || 0;
      e.target.value = val;
      updatePrice(id, field, val);
      showToast('Price updated');
    });
  });

  // Render history
  renderPriceHistory();
}

function renderPriceHistory() {
  const list = document.getElementById('priceHistoryList');
  list.innerHTML = '';
  const history = loadPriceHistory();

  if (history.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-sec);padding:20px">No price changes yet.</p>';
    return;
  }

  // Show last 30
  const recent = history.slice(0, 30);
  recent.forEach(entry => {
    const p = PRODUCTS.find(x => x.id === entry.productId);
    const fieldLabel = entry.field === 'buyPrice' ? 'Buy' : entry.field === 'retailPrice' ? 'Retail' : 'Wholesale';
    const div = document.createElement('div');
    div.className = 'price-history-item';
    div.innerHTML = `
      <span class="ph-date">${entry.date}</span>
      <span class="ph-product">${p ? p.name : entry.productId}</span>
      <span class="ph-change">${fieldLabel}: ₹${entry.oldValue} → ₹${entry.newValue}</span>
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function fmt(n) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg) {
  const t = document.getElementById('saveToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ═══════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  renderHeader();
  renderCategoryTabs();
  renderInventory();
  initScanPage();

  // ── Date navigation ──
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

  // ── Bottom nav ──
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // ── Scan page ──
  document.getElementById('startScanBtn').addEventListener('click', startCameraScan);
  document.getElementById('stopScanBtn').addEventListener('click', stopCameraScan);
  document.getElementById('applyCountBtn').addEventListener('click', applyScanCount);

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
      activeScanType = btn.dataset.type;
    });
  });

  // ── Wholesale modal ──
  document.getElementById('addCustomerBtn').addEventListener('click', openAddCustomerModal);
  document.getElementById('cancelCustomerBtn').addEventListener('click', closeAddCustomerModal);
  document.getElementById('confirmCustomerBtn').addEventListener('click', confirmAddCustomer);
  document.getElementById('customerNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmAddCustomer();
  });
  document.getElementById('addCustomerModal').addEventListener('click', e => {
    if (e.target === document.getElementById('addCustomerModal')) closeAddCustomerModal();
  });

  // ── Service worker ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
