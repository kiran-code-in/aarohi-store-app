'use strict';

/**
 * retail.js — Retail sales page: per-product quantities at MRP.
 */

const Retail = (() => {
  let _timer = null;

  function render() {
    const day = App.getDay();
    const tbody = document.getElementById('retailBody');
    tbody.innerHTML = '';

    let totalQty = 0, totalAmt = 0;

    Data.getProducts().forEach(p => {
      const prices = Pricing.getPrices(p.id);
      const qty = day.retail[p.id] || 0;
      const amt = qty * prices.retailPrice;
      totalQty += qty;
      totalAmt += amt;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-product">${p.name}<br><small style="color:var(--text-sec)">₹${prices.retailPrice}/unit</small></td>
        <td class="col-num">
          <input class="inv-input" type="number" min="0" data-id="${p.id}" value="${qty}" />
        </td>
        <td class="col-num">₹${amt.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('retailTotalQty').textContent = totalQty;
    document.getElementById('retailTotalAmt').textContent = App.fmt(totalAmt);

    tbody.querySelectorAll('.inv-input').forEach(inp => {
      inp.addEventListener('input', onChange);
    });
  }

  function onChange(e) {
    const id = e.target.dataset.id;
    const val = Math.max(0, parseInt(e.target.value) || 0);

    const day = App.getDay();
    if (!day.retail) day.retail = {};
    day.retail[id] = val;
    App.syncSoldTotals(day);
    Storage.saveDay(day, true);

    clearTimeout(_timer);
    _timer = setTimeout(() => { render(); Inventory.renderTable(); }, 600);
  }

  return { render };
})();
