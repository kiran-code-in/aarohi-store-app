'use strict';

/**
 * wholesale.js — Wholesale customers page:
 * search/select customers, per-customer product quantities, totals.
 */

const Wholesale = (() => {
  let _wsTimer = null;

  function render() {
    const day = App.getDay();
    const list = document.getElementById('wholesaleCustomerList');
    list.innerHTML = '';

    day.wholesale.forEach((cust, idx) => {
      const subtotal = calcTotal(cust);
      const card = document.createElement('div');
      card.className = 'customer-card';
      card.innerHTML = `
        <div class="customer-header" data-idx="${idx}">
          <span class="customer-name">${cust.name}</span>
          <span class="customer-subtotal">₹${subtotal.toFixed(2)}</span>
          <button class="customer-toggle" data-idx="${idx}" title="Collapse/Expand">▾</button>
        </div>
        <div class="customer-body" id="custBody_${idx}">
          ${Data.getCategories().map(cat => {
            const catProducts = Data.getProducts().filter(p => p.category === cat);
            const hasQty = catProducts.some(p => (cust.products[p.id] || 0) > 0);
            return `
              <div class="ws-cat-group">
                <div class="ws-cat-header" data-cat="${cat}" data-idx="${idx}">${cat}</div>
                <div class="ws-cat-body${hasQty ? ' open' : ''}" id="wsCat_${idx}_${cat.replace(/\s/g,'')}">
                  ${catProducts.map(p => {
                    const qty = cust.products[p.id] || 0;
                    const prices = Pricing.getPrices(p.id);
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

    // Toggle expand/collapse
    list.querySelectorAll('.customer-header').forEach(h => {
      h.addEventListener('click', () => {
        const idx = h.dataset.idx;
        const body = document.getElementById(`custBody_${idx}`);
        body.classList.toggle('open');
        const toggle = h.querySelector('.customer-toggle');
        if (toggle) toggle.textContent = body.classList.contains('open') ? '▾' : '▸';
      });
    });

    // Category group toggle
    list.querySelectorAll('.ws-cat-header').forEach(h => {
      h.addEventListener('click', () => {
        const cat = h.dataset.cat;
        const idx = h.dataset.idx;
        const body = document.getElementById(`wsCat_${idx}_${cat.replace(/\s/g,'')}`);
        if (body) body.classList.toggle('open');
      });
    });

    // Input changes via event delegation
    list.addEventListener('input', (e) => {
      if (e.target.classList.contains('ws-qty-input')) {
        onQtyChange(e);
      }
    });

    renderTotals(day);
    renderCustomerSearch();
  }

  function calcTotal(cust) {
    let t = 0;
    Data.getProducts().forEach(p => {
      t += (cust.products[p.id] || 0) * Pricing.getPrices(p.id).wholesalePrice;
    });
    return t;
  }

  function getSoldForProduct(day, productId) {
    let total = 0;
    (day.wholesale || []).forEach(c => { total += (c.products[productId] || 0); });
    return total;
  }

  function onQtyChange(e) {
    const idx = parseInt(e.target.dataset.custidx);
    const pid = e.target.dataset.pid;
    const val = Math.max(0, parseInt(e.target.value) || 0);

    const day = App.getDay();
    if (!day.wholesale[idx]) return;
    if (!day.wholesale[idx].products) day.wholesale[idx].products = {};
    day.wholesale[idx].products[pid] = val;

    App.syncSoldTotals(day);
    Storage.saveDay(day, true);

    // Update subtotal in-place
    const headerEl = document.querySelector(`.customer-header[data-idx="${idx}"] .customer-subtotal`);
    if (headerEl) headerEl.textContent = '₹' + calcTotal(day.wholesale[idx]).toFixed(2);

    clearTimeout(_wsTimer);
    _wsTimer = setTimeout(() => { renderTotals(day); Inventory.renderTable(); }, 500);
  }

  function renderTotals(day) {
    const head = document.getElementById('wholesaleTotalsHead');
    const body = document.getElementById('wholesaleTotalsBody');
    head.innerHTML = '';
    body.innerHTML = '';
    Data.getProducts().forEach(p => {
      const th = document.createElement('th');
      th.textContent = p.name;
      head.appendChild(th);
    });
    Data.getProducts().forEach(p => {
      let total = 0;
      (day.wholesale || []).forEach(c => { total += c.products[p.id] || 0; });
      const td = document.createElement('td');
      td.textContent = total;
      body.appendChild(td);
    });
  }

  // ── Customer search list ──
  function renderCustomerSearch() {
    renderCustomerList('');
    const searchInput = document.getElementById('customerSearchInput');
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    newInput.addEventListener('input', (e) => {
      renderCustomerList(e.target.value.trim().toLowerCase());
    });
  }

  function renderCustomerList(filter) {
    const day = App.getDay();
    const container = document.getElementById('customerListScroll');
    container.innerHTML = '';

    const filtered = Data.getCustomers().filter(name =>
      !filter || name.toLowerCase().includes(filter)
    );

    if (filtered.length === 0 && filter) {
      container.innerHTML = `<div class="cl-empty">No match. Use "+ Add New" below.</div>`;
      return;
    }

    filtered.forEach(name => {
      const alreadyAdded = day.wholesale.some(c => c.name.toLowerCase() === name.toLowerCase());
      const row = document.createElement('div');
      row.className = 'cl-row' + (alreadyAdded ? ' cl-added' : '');
      row.innerHTML = `
        <span class="cl-name">${name}</span>
        <span class="cl-status">${alreadyAdded ? '✓ Added' : 'Tap to add'}</span>
      `;
      if (!alreadyAdded) {
        row.addEventListener('click', () => {
          addCustomer(name);
          renderCustomerList(document.getElementById('customerSearchInput').value.trim().toLowerCase());
        });
      }
      container.appendChild(row);
    });
  }

  function addCustomer(name) {
    const day = App.getDay();
    if (day.wholesale.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      App.showToast(`${name} already added`);
      return;
    }
    // New customer at top
    day.wholesale.unshift({ name, products: {} });
    Storage.saveDay(day, true);
    render();
    // Collapse all, expand only new one
    setTimeout(() => {
      document.querySelectorAll('.customer-body').forEach(b => b.classList.remove('open'));
      document.querySelectorAll('.customer-toggle').forEach(t => t.textContent = '▸');
      const newBody = document.getElementById('custBody_0');
      if (newBody) {
        newBody.classList.add('open');
        const toggle = document.querySelector('.customer-header[data-idx="0"] .customer-toggle');
        if (toggle) toggle.textContent = '▾';
        newBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  function addCustomerFromModal() {
    const name = document.getElementById('customerNameInput').value.trim();
    if (!name) return;
    addCustomer(name);
    document.getElementById('addCustomerModal').classList.remove('open');
  }

  return { render, getSoldForProduct, addCustomerFromModal };
})();
