'use strict';

/**
 * pricing.js — Price management with history tracking.
 * Prices can be overridden per product. Changes are logged with dates.
 */

const Pricing = (() => {

  // Get current effective prices for a product (user overrides or defaults from JSON)
  function getPrices(productId) {
    const stored = Storage.loadPrices();
    if (stored && stored[productId]) {
      return stored[productId];
    }
    const p = Data.findById(productId);
    if (!p) return { buyPrice: 0, retailPrice: 0, wholesalePrice: 0 };
    return { buyPrice: p.buyPrice, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice };
  }

  // Update a specific price field and record history
  function updatePrice(productId, field, newValue) {
    const prices = Storage.loadPrices() || {};
    const current = getPrices(productId);
    const oldValue = current[field];

    if (!prices[productId]) {
      prices[productId] = { ...current };
    }
    prices[productId][field] = newValue;
    Storage.savePrices(prices);

    // Record history
    const history = Storage.loadPriceHistory();
    history.unshift({
      productId,
      field,
      oldValue,
      newValue,
      date: App.todayKey(),
      timestamp: Date.now(),
    });
    if (history.length > 200) history.length = 200;
    Storage.savePriceHistory(history);
  }

  return { getPrices, updatePrice };
})();
