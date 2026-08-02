'use strict';

/**
 * sheets-sync.js — Fetches daily data from published Google Sheet CSV.
 * The sheet is the "source of truth" for product reference data.
 * Falls back to local products.json if sheet is unreachable (offline).
 *
 * Sheet URL (published CSV):
 * https://docs.google.com/spreadsheets/d/e/2PACX-1vSWK5e4dRgU0Sc6bLXhzbWaGAgzO2Cn_uPDkQb0T-Dt-mkLBZcvFPjhmQBKALHjamrMvmWE3T85TxHE/pub?output=csv
 */

const SheetsSync = (() => {
  const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWK5e4dRgU0Sc6bLXhzbWaGAgzO2Cn_uPDkQb0T-Dt-mkLBZcvFPjhmQBKALHjamrMvmWE3T85TxHE/pub?output=csv';
  const CACHE_KEY = 'aarohi_sheet_cache';
  const CACHE_TIME_KEY = 'aarohi_sheet_cache_time';
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  /**
   * Fetch and parse the published sheet CSV.
   * Returns parsed day data or null on failure.
   */
  async function fetchSheet() {
    try {
      // Check cache age
      const lastFetch = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');
      if (Date.now() - lastFetch < CACHE_DURATION) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) return JSON.parse(cached);
      }

      const resp = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const csv = await resp.text();
      const parsed = parseSheetCSV(csv);

      // Cache it
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));

      return parsed;
    } catch (e) {
      console.warn('Sheet fetch failed, using cached/local:', e.message);
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    }
  }

  /**
   * Parse the CSV into structured data matching the sheet format:
   * - products: array of {name, received, yesterday, sold, available, damaged}
   * - wholesale: array of {name, products: {productName: qty}}
   * - retail: {productName: qty}
   */
  function parseSheetCSV(csv) {
    const rows = csv.split('\n').map(row => parseCSVRow(row));
    if (rows.length < 3) return null;

    // Product names from header row (columns B onwards)
    const productNames = ['FCM', 'STD', 'Milk 200ml', 'Curd 500ml', 'Curd 200ml', 'Curd 10L', 'Curd 5L', 'Butter Milk', 'Lussi'];

    // Parse inventory section (rows 3-11 typically)
    const inventory = {};
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const name = (row[0] || '').trim();
      if (!name || name === '' || name.startsWith('Total') || name.startsWith('Today')) break;
      if (name === 'Whoe Sale' || name === 'Wholesale' || name === 'Retail') break;

      // Match product name to our product list
      const matchedProduct = productNames.find(pn => pn.toLowerCase() === name.toLowerCase());
      if (matchedProduct) {
        inventory[matchedProduct] = {
          received: parseNum(row[1]),
          yesterdayRemaining: parseNum(row[2]),
          soldToday: parseNum(row[3]),
          totalAvailable: parseNum(row[4]),
          damaged: parseNum(row[5]),
        };
      }
    }

    // Find wholesale section
    const wholesale = [];
    const retail = {};
    let section = 'inventory';
    let wsHeaderRow = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = (row[0] || '').trim();
      const secondCell = (row[1] || '').trim();

      if (secondCell === 'Whoe Sale' || secondCell === 'Wholesale') {
        section = 'wholesale-header';
        wsHeaderRow = i + 1; // next row is the column headers
        continue;
      }

      if (section === 'wholesale-header') {
        section = 'wholesale';
        continue; // skip the header row (Person Name, FCM, STD...)
      }

      if (section === 'wholesale') {
        if (!firstCell || firstCell === 'Total Sold' || firstCell.startsWith('Total')) break;

        const custData = { name: firstCell, products: {} };
        for (let c = 1; c <= 9 && c < row.length; c++) {
          const qty = parseNum(row[c]);
          if (qty > 0 && productNames[c - 1]) {
            custData.products[productNames[c - 1]] = qty;
          }
        }
        // Retail columns (columns 10-16)
        for (let c = 10; c <= 16 && c < row.length; c++) {
          const qty = parseNum(row[c]);
          if (qty > 0 && productNames[c - 10]) {
            retail[productNames[c - 10]] = (retail[productNames[c - 10]] || 0) + qty;
          }
        }
        if (Object.keys(custData.products).length > 0) {
          wholesale.push(custData);
        }
      }
    }

    return { inventory, wholesale, retail, fetchedAt: new Date().toISOString() };
  }

  function parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  }

  function parseNum(val) {
    if (!val) return 0;
    // Remove ₹, commas, spaces
    const cleaned = String(val).replace(/[₹,\s]/g, '');
    return parseInt(cleaned) || 0;
  }

  /**
   * Get the sheet URL for display/config purposes
   */
  function getSheetUrl() {
    return SHEET_CSV_URL;
  }

  /**
   * Check if we have cached sheet data
   */
  function hasCachedData() {
    return !!localStorage.getItem(CACHE_KEY);
  }

  /**
   * Get last sync time
   */
  function getLastSyncTime() {
    const t = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');
    if (!t) return 'Never';
    return new Date(t).toLocaleString('en-IN');
  }

  return { fetchSheet, getSheetUrl, hasCachedData, getLastSyncTime };
})();
