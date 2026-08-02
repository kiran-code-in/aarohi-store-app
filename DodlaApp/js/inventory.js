'use strict';

/**
 * inventory.js — Inventory page: category tabs, product table,
 * received/sold/damaged tracking, summary bar.
 */

const Inventory = (() => {
  let activeCategory = '';

  function render() {
    if (!activeCategory) activeCategory = Data.getCategories()[0] || '';
    renderCategoryTabs();
    renderTable();
  }

  function renderCategoryTabs() {
    const container = document.getElementById('categoryTabs');
    container.innerHTML = '';
    Data.getCategories().forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (cat === activeCategory ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeCategory = cat;
        render();
      });
      container.appendChild(btn);
    });
  }

  let _renderTimer = null;
  function renderTable() {
    const day = App.getDay();
    const tbody = document.getElementById('inventoryBody');
    tbody.innerHTML = '';

    let totalRevenue = 0, totalCost = 0, damagedAmt = 0;
    const filtered = Data.getProducts().filter(p => p.category === activeCategory);

    let currentSubcat = null;
    filtered.forEach(p => {
      // Subcategory header row
      const subcat = p.subcategory || '';
      if (subcat && subcat !== currentSubcat) {
        currentSubcat = subcat;
        const subRow = document.createElement('tr');
        subRow.className = 'subcat-row';
        subRow.innerHTML = `<td colspan="6" class="subcat-cell">${subcat}</td>`;
        tbody.appendChild(subRow);
      } else if (!subcat && currentSubcat) {
        currentSubcat = null;
      }

      const prices = Pricing.getPrices(p.id);
      const inv = day.inventory[p.id] || { received: 0, yesterdayRemaining: 0, soldToday: 0, totalAvailable: 0, damaged: 0, manualSold: 0 };
      const wsSold = Wholesale.getSoldForProduct(day, p.id);
      const retailSold = day.retail[p.id] || 0;
      totalRevenue += (wsSold * prices.wholesalePrice) + (retailSold * prices.retailPrice);
      totalCost += inv.soldToday * prices.buyPrice;
      damagedAmt += inv.damaged * prices.buyPrice;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-product">${p.name}<span class="product-price">Buy ₹${prices.buyPrice} · Sell ₹${prices.retailPrice}</span></td>
        <td class="col-num">
          <input class="inv-input" type="number" min="0" inputmode="numeric"
                 data-id="${p.id}" data-field="received" value="${inv.received}" />
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
                 data-id="${p.id}" data-field="damaged" value="${inv.damaged}" />
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Totals across ALL categories
    Data.getProducts().forEach(p => {
      if (p.category !== activeCategory) {
        const prices = Pricing.getPrices(p.id);
        const inv = day.inventory[p.id] || {};
        const wsSold = Wholesale.getSoldForProduct(day, p.id);
        const retailSold = day.retail[p.id] || 0;
        totalRevenue += (wsSold * prices.wholesalePrice) + (retailSold * prices.retailPrice);
        totalCost += (inv.soldToday || 0) * prices.buyPrice;
        damagedAmt += (inv.damaged || 0) * prices.buyPrice;
      }
    });

    document.getElementById('totalRevenue').textContent = App.fmt(totalRevenue);
    document.getElementById('totalProfit').textContent = App.fmt(totalRevenue - totalCost);
    document.getElementById('totalDamagedLoss').textContent = App.fmt(damagedAmt);

    // Event: received/damaged inputs
    tbody.querySelectorAll('.inv-input').forEach(inp => {
      inp.addEventListener('input', onFieldChange);
    });
    // Event: sold +/-
    tbody.querySelectorAll('.sold-plus').forEach(btn => {
      btn.addEventListener('click', () => onSoldDelta(btn.dataset.id, +1));
    });
    tbody.querySelectorAll('.sold-minus').forEach(btn => {
      btn.addEventListener('click', () => onSoldDelta(btn.dataset.id, -1));
    });
  }

  function onFieldChange(e) {
    const id = e.target.dataset.id;
    const field = e.target.dataset.field;
    const val = Math.max(0, parseInt(e.target.value) || 0);
    const day = App.getDay();
    if (!day.inventory[id]) day.inventory[id] = App.emptyInv();
    day.inventory[id][field] = val;
    App.recalcInventory(day);
    Storage.saveDay(day, true);
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(() => renderTable(), 600);
  }

  function onSoldDelta(productId, delta) {
    const day = App.getDay();
    if (!day.inventory[productId]) day.inventory[productId] = App.emptyInv();
    day.inventory[productId].manualSold = Math.max(0, (day.inventory[productId].manualSold || 0) + delta);
    App.syncSoldTotals(day);
    Storage.saveDay(day, true);
    renderTable();
  }

  return { render, renderTable };
})();
