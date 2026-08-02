'use strict';

// ═══════════════════════════════════════════════════════════════
//  PRODUCT CATALOG — organized by category
// ═══════════════════════════════════════════════════════════════
const PRODUCTS = [
  // ── Milk Products ──
  { id: 'FCM',       name: 'FCM (Full Cream)', category: 'Milk', price: 38,   barcodes: ['FCM','FCM1'] },
  { id: 'STD',       name: 'STD (Standard)',   category: 'Milk', price: 33,   barcodes: ['STD','STD1'] },
  { id: 'MILK200',   name: 'Milk 200ml',       category: 'Milk', price: 9.5,  barcodes: ['MILK200','M200'] },
  { id: 'CURD500',   name: 'Curd 500ml',       category: 'Milk', price: 34,   barcodes: ['CURD500','C500'] },
  { id: 'CURD200',   name: 'Curd 200ml',       category: 'Milk', price: 9.5,  barcodes: ['CURD200','C200'] },
  { id: 'CURD10L',   name: 'Curd 10L',         category: 'Milk', price: 630,  barcodes: ['CURD10L','C10L'] },
  { id: 'CURD5L',    name: 'Curd 5L',          category: 'Milk', price: 320,  barcodes: ['CURD5L','C5L'] },
  { id: 'LUSSI',     name: 'Lussi',            category: 'Milk', price: 9.5,  barcodes: ['LUSSI'] },
  { id: 'BUTTERMILK',name: 'Butter Milk',      category: 'Milk', price: 8.5,  barcodes: ['BM','BM1','BUTTERMILK'] },

  // ── Ice Cream ──
  { id: 'IC_CONE',   name: 'Cone',             category: 'Ice Cream', price: 20,  barcodes: ['CONE'] },
  { id: 'IC_CUP',    name: 'Cup',              category: 'Ice Cream', price: 30,  barcodes: ['ICCUP'] },
  { id: 'IC_FAMILY', name: 'Family Pack',      category: 'Ice Cream', price: 120, barcodes: ['ICFAM'] },
  { id: 'IC_CANDY',  name: 'Candy/Bar',        category: 'Ice Cream', price: 15,  barcodes: ['ICBAR'] },
  { id: 'IC_CHOCOBAR',name:'Chocobar',         category: 'Ice Cream', price: 25,  barcodes: ['CHOCO'] },

  // ── Soft Drinks ──
  { id: 'SD_SMALL',  name: 'Soft Drink 250ml', category: 'Soft Drinks', price: 20,  barcodes: ['SD250'] },
  { id: 'SD_MED',    name: 'Soft Drink 500ml', category: 'Soft Drinks', price: 40,  barcodes: ['SD500'] },
  { id: 'SD_LARGE',  name: 'Soft Drink 1L',    category: 'Soft Drinks', price: 70,  barcodes: ['SD1L'] },
  { id: 'SD_WATER',  name: 'Water Bottle',     category: 'Soft Drinks', price: 20,  barcodes: ['WATER'] },
  { id: 'SD_JUICE',  name: 'Juice',            category: 'Soft Drinks', price: 30,  barcodes: ['JUICE'] },

  // ── Ready to Cook ──
  { id: 'RC_CHAPATHI',name:'Chapathi',         category: 'Ready to Cook', price: 40,  barcodes: ['CHAP'] },
  { id: 'RC_POORI',   name:'Poori',            category: 'Ready to Cook', price: 40,  barcodes: ['POORI'] },
  { id: 'RC_PAROTA',  name:'Parota',           category: 'Ready to Cook', price: 45,  barcodes: ['PAROTA'] },
  { id: 'RC_IDLY',    name:'Idly Batter',      category: 'Ready to Cook', price: 60,  barcodes: ['IDLY'] },
  { id: 'RC_DOSA',    name:'Dosa Batter',      category: 'Ready to Cook', price: 60,  barcodes: ['DOSA'] },
];

// Category list (derived)
const CATEGORIES = [...new Set(PRODUCTS.map(p => p.category))];

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

function saveDay(day) {
  localStorage.setItem(storageKey(day.dateKey), JSON.stringify(day));
  showToast('Saved');
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

  let totalAmt = 0;
  let damagedAmt = 0;

  // Show only products for the selected category
  const filtered = PRODUCTS.filter(p => p.category === activeCategory);

  filtered.forEach(p => {
    const inv = day.inventory[p.id] || { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0 };
    const amt = inv.soldToday * p.price;
    totalAmt += amt;
    damagedAmt += inv.damaged * p.price;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-product">${p.name}<span class="product-price">₹${p.price}</span></td>
      <td class="col-num">
        <input class="inv-input" type="number" min="0" inputmode="numeric"
               data-id="${p.id}" data-field="received"
               value="${inv.received}" />
      </td>
      <td class="col-num total-cell">${inv.yesterdayRemaining}</td>
      <td class="col-num total-cell">${inv.soldToday}</td>
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
      const inv = day.inventory[p.id] || {};
      totalAmt += (inv.soldToday || 0) * p.price;
      damagedAmt += (inv.damaged || 0) * p.price;
    }
  });

  document.getElementById('totalAmountToday').textContent = fmt(totalAmt);
  document.getElementById('totalDamagedLoss').textContent = fmt(damagedAmt);

  // attach input listeners
  tbody.querySelectorAll('.inv-input').forEach(inp => {
    inp.addEventListener('change', onInventoryChange);
  });
}

function onInventoryChange(e) {
  const inp = e.target;
  const id = inp.dataset.id;
  const field = inp.dataset.field;
  const val = Math.max(0, parseInt(inp.value) || 0);
  inp.value = val;

  const day = getDay(currentDate);
  if (!day.inventory[id]) day.inventory[id] = { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0 };
  day.inventory[id][field] = val;
  recalcInventory(day);
  saveDay(day);
  renderInventory();
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
        <button class="customer-del" data-del="${idx}" title="Remove">🗑</button>
      </div>
      <div class="customer-body" id="custBody_${idx}">
        ${PRODUCTS.map(p => {
          const qty = cust.products[p.id] || 0;
          return `
            <div class="ws-product-row">
              <span class="ws-product-label">${p.name}</span>
              <span class="ws-product-price">₹${p.price}</span>
              <input class="ws-qty-input" type="number" min="0"
                     data-custidx="${idx}" data-pid="${p.id}"
                     value="${qty}" placeholder="0" />
            </div>`;
        }).join('')}
      </div>
    `;
    list.appendChild(card);
  });

  // toggle expand
  list.querySelectorAll('.customer-header').forEach(h => {
    h.addEventListener('click', (e) => {
      if (e.target.dataset.del !== undefined) return;
      const idx = h.dataset.idx;
      const body = document.getElementById(`custBody_${idx}`);
      body.classList.toggle('open');
    });
  });

  // delete customer
  list.querySelectorAll('.customer-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.del);
      const day = getDay(currentDate);
      day.wholesale.splice(idx, 1);
      saveDay(day);
      renderWholesale();
    });
  });

  // input changes
  list.querySelectorAll('.ws-qty-input').forEach(inp => {
    inp.addEventListener('change', onWholesaleChange);
  });

  renderWholesaleTotals(day);
  renderQuickAddChips();
}

function calcCustomerTotal(cust) {
  let t = 0;
  PRODUCTS.forEach(p => { t += (cust.products[p.id] || 0) * p.price; });
  return t;
}

function onWholesaleChange(e) {
  const inp = e.target;
  const idx = parseInt(inp.dataset.custidx);
  const pid = inp.dataset.pid;
  const val = Math.max(0, parseInt(inp.value) || 0);
  inp.value = val;

  const day = getDay(currentDate);
  if (!day.wholesale[idx].products) day.wholesale[idx].products = {};
  day.wholesale[idx].products[pid] = val;

  // sync wholesale sold into inventory
  syncWholesaleToInventory(day);
  saveDay(day);
  renderWholesale();
  renderInventory();
}

function syncWholesaleToInventory(day) {
  // reset sold from wholesale
  PRODUCTS.forEach(p => {
    let wsSold = 0;
    day.wholesale.forEach(c => { wsSold += c.products[p.id] || 0; });
    const retailQty = day.retail[p.id] || 0;
    day.inventory[p.id].soldToday = wsSold + retailQty;
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
    const qty = day.retail[p.id] || 0;
    const amt = qty * p.price;
    totalQty += qty;
    totalAmt += amt;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-product">${p.name}<br><small style="color:#999">₹${p.price}/unit</small></td>
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
    inp.addEventListener('change', onRetailChange);
  });
}

function onRetailChange(e) {
  const inp = e.target;
  const id = inp.dataset.id;
  const val = Math.max(0, parseInt(inp.value) || 0);
  inp.value = val;

  const day = getDay(currentDate);
  if (!day.retail) day.retail = {};
  day.retail[id] = val;
  syncWholesaleToInventory(day);
  saveDay(day);
  renderRetail();
  renderInventory();
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
    PRODUCTS.forEach(p => { totalAmt += (day.inventory[p.id]?.soldToday || 0) * p.price; });

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
            <span style="color:var(--green)">₹${((inv.soldToday || 0) * p.price).toFixed(2)}</span>
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
        opt.textContent = `${p.name}  (₹${p.price})`;
        grp.appendChild(opt);
      });
      select.appendChild(grp);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  QUICK-ADD CHIPS  (regular customer chips on wholesale page)
// ═══════════════════════════════════════════════════════════════
function renderQuickAddChips() {
  const day = getDay(currentDate);
  const container = document.getElementById('quickAddChips');
  container.innerHTML = '';

  REGULAR_CUSTOMERS.forEach(name => {
    const alreadyAdded = day.wholesale.some(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    const chip = document.createElement('button');
    chip.className = 'quick-chip' + (alreadyAdded ? ' added' : '');
    chip.textContent = alreadyAdded ? `✓ ${name}` : name;
    chip.addEventListener('click', () => {
      if (alreadyAdded) {
        // Remove this customer
        const day = getDay(currentDate);
        const idx = day.wholesale.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
        if (idx >= 0) {
          day.wholesale.splice(idx, 1);
          saveDay(day);
          renderWholesale();
        }
      } else {
        addCustomerByName(name);
      }
    });
    container.appendChild(chip);
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
  day.wholesale.push({ name, products: {} });
  saveDay(day);
  renderWholesale();
  // auto-expand ALL customer cards so nothing is hidden
  setTimeout(() => {
    document.querySelectorAll('.customer-body').forEach(b => b.classList.add('open'));
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
