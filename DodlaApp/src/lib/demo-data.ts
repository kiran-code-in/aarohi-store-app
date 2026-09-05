/**
 * demo-data.ts — In-memory mock data for testing without Supabase.
 * Activated by adding ?demo=1 to the URL, or localStorage 'aarohi_demo' = '1'.
 * All data lives in memory + localStorage — nothing hits the database.
 */

import type {
  Category, Product, Customer, InventoryTransaction, CustomerNote,
} from '@/types/database.types';

// ── Demo mode detection ──
export function isDemoMode(): boolean {
  const url = new URLSearchParams(window.location.search);
  if (url.get('demo') === '1') {
    localStorage.setItem('aarohi_demo', '1');
    return true;
  }
  if (url.get('demo') === '0') {
    localStorage.removeItem('aarohi_demo');
    return false;
  }
  return localStorage.getItem('aarohi_demo') === '1';
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Demo Categories ──
export const DEMO_CATEGORIES: Category[] = [
  { id: 1, name: 'Milk' },
  { id: 2, name: 'Ice Cream' },
  { id: 3, name: 'Soft Drinks' },
  { id: 4, name: 'Ready to Cook' },
];

// ── Demo Products ──
export const DEMO_PRODUCTS: Product[] = [
  { id: 1, category_id: 1, product_type: 'Milk',  product_name: 'TEST FCM',        purchase_price: 37, retail_price: 40, wholesale_price: 39, min_stock: 5, tracking_mode: null, active: true, created_at: null, updated_at: null },
  { id: 2, category_id: 1, product_type: 'Milk',  product_name: 'TEST STD',        purchase_price: 31, retail_price: 35, wholesale_price: 34, min_stock: 5, tracking_mode: null, active: true, created_at: null, updated_at: null },
  { id: 3, category_id: 1, product_type: 'Curd',  product_name: 'TEST Curd 500ml', purchase_price: 33, retail_price: 38, wholesale_price: 36, min_stock: 5, tracking_mode: null, active: true, created_at: null, updated_at: null },
  { id: 4, category_id: 1, product_type: 'Milk',  product_name: 'TEST Butter Milk',purchase_price: 7,  retail_price: 10, wholesale_price: 9,  min_stock: 5, tracking_mode: null, active: true, created_at: null, updated_at: null },
  { id: 5, category_id: 2, product_type: 'Cup',   product_name: 'TEST Cup 20',     purchase_price: 16, retail_price: 20, wholesale_price: 18, min_stock: 3, tracking_mode: null, active: true, created_at: null, updated_at: null },
  { id: 6, category_id: 2, product_type: 'Cone',  product_name: 'TEST Vanilla Cone',purchase_price: 16,retail_price: 20, wholesale_price: 18, min_stock: 3, tracking_mode: null, active: true, created_at: null, updated_at: null },
  { id: 7, category_id: 3, product_type: 'Cola',  product_name: 'TEST Cola 500ml', purchase_price: 32, retail_price: 40, wholesale_price: 36, min_stock: 5, tracking_mode: null, active: true, created_at: null, updated_at: null },
  { id: 8, category_id: 4, product_type: null,    product_name: 'TEST Chapathi',   purchase_price: 32, retail_price: 40, wholesale_price: 36, min_stock: 3, tracking_mode: null, active: true, created_at: null, updated_at: null },
];

// ── Demo Customers ──
export const DEMO_CUSTOMERS: Customer[] = [
  { id: 'demo-c1', name: 'TEST Ramesh',    phone: null, address: null, customer_type: 'wholesale', created_at: null },
  { id: 'demo-c2', name: 'TEST Suresh',    phone: null, address: null, customer_type: 'wholesale', created_at: null },
  { id: 'demo-c3', name: 'TEST Village Shop', phone: null, address: null, customer_type: 'wholesale', created_at: null },
];

// ── Mutable in-memory stores (persisted to localStorage) ──
const TX_KEY = 'aarohi_demo_txns';
const NOTES_KEY = 'aarohi_demo_notes';

let _nextTxId = 1000;
let _nextNoteId = 500;

export function loadDemoTxns(): InventoryTransaction[] {
  const raw = localStorage.getItem(TX_KEY);
  if (raw) return JSON.parse(raw);
  // Seed one test day (today) with sample data
  const seed: InventoryTransaction[] = [
    { id: 1, product_id: 1, transaction_type: 'received', quantity: 30, remarks: null, transaction_date: today(), created_at: null, sale_type: null, customer_id: null },
    { id: 2, product_id: 2, transaction_type: 'received', quantity: 20, remarks: null, transaction_date: today(), created_at: null, sale_type: null, customer_id: null },
    { id: 3, product_id: 3, transaction_type: 'received', quantity: 25, remarks: null, transaction_date: today(), created_at: null, sale_type: null, customer_id: null },
    { id: 4, product_id: 1, transaction_type: 'sold', quantity: 8, remarks: 'TEST Ramesh', transaction_date: today(), created_at: null, sale_type: 'wholesale', customer_id: 'demo-c1' },
    { id: 5, product_id: 3, transaction_type: 'sold', quantity: 5, remarks: 'TEST Ramesh', transaction_date: today(), created_at: null, sale_type: 'wholesale', customer_id: 'demo-c1' },
    { id: 6, product_id: 1, transaction_type: 'sold', quantity: 6, remarks: null, transaction_date: today(), created_at: null, sale_type: 'retail', customer_id: null },
    { id: 7, product_id: 4, transaction_type: 'sold', quantity: 10, remarks: null, transaction_date: today(), created_at: null, sale_type: 'retail', customer_id: null },
    { id: 8, product_id: 3, transaction_type: 'damaged', quantity: 1, remarks: null, transaction_date: today(), created_at: null, sale_type: null, customer_id: null },
  ];
  saveDemoTxns(seed);
  return seed;
}

export function saveDemoTxns(txns: InventoryTransaction[]): void {
  localStorage.setItem(TX_KEY, JSON.stringify(txns));
}

export function nextTxId(): number { return _nextTxId++; }

export function loadDemoNotes(): CustomerNote[] {
  const raw = localStorage.getItem(NOTES_KEY);
  if (raw) return JSON.parse(raw);
  const seed: CustomerNote[] = [
    { id: 1, customer_id: 'demo-c1', note_type: 'payment', amount: 200, note: 'Paid part', note_date: today(), created_at: null },
  ];
  localStorage.setItem(NOTES_KEY, JSON.stringify(seed));
  return seed;
}

export function saveDemoNotes(notes: CustomerNote[]): void {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function nextNoteId(): number { return _nextNoteId++; }

/** Reset all demo data back to seed state */
export function resetDemoData(): void {
  localStorage.removeItem(TX_KEY);
  localStorage.removeItem(NOTES_KEY);
}
