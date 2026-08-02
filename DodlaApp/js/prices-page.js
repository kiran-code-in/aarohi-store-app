'use strict';

/**
 * prices-page.js — Price management settings page.
 */

const PricesPage = (() => {

  function render() {
    const container = document.getElementById('pricesBody');
    container.innerHTML = '';

    let currentCat = '';
    Data.getProducts().forEach(p => {
      if (p.category !== currentCat) {
        currentCat = p.category;
        const catDiv = document.createElement('div');
        catDiv.className = 'price-category-header';
        catDiv.textContent = currentCat;
        container.appendChild(catDiv);
      }

      const prices = Pricing.getPrices(p.id);
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

    container.querySelectorAll('.price-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;
        const val = parseFloat(e.target.value) || 0;
        e.target.value = val;
        Pricing.updatePrice(id, field, val);
        App.showToast('Price updated');
      });
    });

    renderHistory();
  }

  function renderHistory() {
    const list = document.getElementById('priceHistoryList');
    list.innerHTML = '';
    const history = Storage.loadPriceHistory();

    if (history.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-sec);padding:20px">No price changes yet.</p>';
      return;
    }

    history.slice(0, 30).forEach(entry => {
      const p = Data.findById(entry.productId);
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

  return { render };
})();
