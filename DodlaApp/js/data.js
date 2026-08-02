'use strict';

/**
 * data.js — Loads reference data from data/products.json.
 * Exposes: Data.products, Data.categories, Data.customers
 * Call Data.init() once at startup.
 */

const Data = (() => {
  let products = [];
  let categories = [];
  let customers = [];

  async function init() {
    try {
      const resp = await fetch('./data/products.json');
      const json = await resp.json();
      products = json.products || [];
      customers = json.customers || [];
      categories = [...new Set(products.map(p => p.category))];
    } catch (e) {
      console.error('Failed to load products.json:', e);
      // Fallback: empty
      products = [];
      categories = [];
      customers = [];
    }
  }

  function getProducts() { return products; }
  function getCategories() { return categories; }
  function getCustomers() { return customers; }

  function findById(id) { return products.find(p => p.id === id) || null; }

  function findByBarcode(code) {
    const c = (code || '').trim().toUpperCase();
    return products.find(p =>
      p.barcodes.some(b => b.toUpperCase() === c)
    ) || null;
  }

  return { init, getProducts, getCategories, getCustomers, findById, findByBarcode };
})();
