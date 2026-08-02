'use strict';

/**
 * history.js — Sales history page: daily records expandable.
 */

const History = (() => {

  function render() {
    const list = document.getElementById('historyList');
    list.innerHTML = '';

    const keys = Storage.getAllDayKeys();

    if (keys.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-sec);padding:30px">No history yet.<br>Start entering daily data.</p>';
      return;
    }

    keys.forEach(dateKey => {
      const day = Storage.loadDay(dateKey);
      if (!day) return;

      let totalAmt = 0;
      Data.getProducts().forEach(p => {
        totalAmt += (day.inventory[p.id]?.soldToday || 0) * Pricing.getPrices(p.id).retailPrice;
      });

      const div = document.createElement('div');
      div.className = 'history-day';
      div.innerHTML = `
        <div class="history-day-header" data-key="${dateKey}">
          <span class="history-day-date">${App.fmtDisplay(dateKey)}</span>
          <span class="history-day-total">${App.fmt(totalAmt)}</span>
        </div>
        <div class="history-day-body" id="hist_${dateKey}">
          ${Data.getProducts().map(p => {
            const inv = day.inventory[p.id] || {};
            const price = Pricing.getPrices(p.id).retailPrice;
            return `<div class="history-row">
              <span>${p.name}</span>
              <span>Recd: ${inv.received || 0} | Sold: ${inv.soldToday || 0} | Dmg: ${inv.damaged || 0}</span>
              <span style="color:var(--green)">₹${((inv.soldToday || 0) * price).toFixed(2)}</span>
            </div>`;
          }).join('')}
          <div class="history-row" style="margin-top:6px;font-weight:700">
            <span>Total Revenue</span>
            <span></span>
            <span style="color:var(--green)">${App.fmt(totalAmt)}</span>
          </div>
        </div>
      `;
      list.appendChild(div);
    });

    list.querySelectorAll('.history-day-header').forEach(h => {
      h.addEventListener('click', () => {
        document.getElementById(`hist_${h.dataset.key}`).classList.toggle('open');
      });
    });
  }

  return { render };
})();
