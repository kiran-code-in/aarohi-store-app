'use strict';

/**
 * storage.js — Centralized data persistence layer.
 * Today: localStorage. Tomorrow: swap to IndexedDB or cloud API.
 * Only this file touches localStorage directly.
 */

const Storage = (() => {
  const PREFIX = 'aarohi_';
  const PRICES_KEY = 'aarohi_prices';
  const PRICE_HISTORY_KEY = 'aarohi_price_history';

  // ── Day records ──
  function dayKey(dateKey) { return PREFIX + dateKey; }

  function loadDay(dateKey) {
    const raw = localStorage.getItem(dayKey(dateKey));
    return raw ? JSON.parse(raw) : null;
  }

  function saveDay(day, silent) {
    localStorage.setItem(dayKey(day.dateKey), JSON.stringify(day));
    if (!silent && typeof App !== 'undefined') App.showToast('Saved');
  }

  function getAllDayKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX) && k !== PRICES_KEY && k !== PRICE_HISTORY_KEY) {
        keys.push(k.replace(PREFIX, ''));
      }
    }
    return keys.sort((a, b) => b.localeCompare(a));
  }

  // ── Prices ──
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

  return {
    loadDay,
    saveDay,
    getAllDayKeys,
    loadPrices,
    savePrices,
    loadPriceHistory,
    savePriceHistory,
  };
})();
