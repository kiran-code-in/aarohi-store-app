/**
 * wholesale.ts — Wholesale page: search/add customers, per-customer product quantities.
 */

import { AppState, formatCurrency } from '@/lib/state';
import { customerService, productService, inventoryService } from '@/services';
import { priceService } from '@/services';
import { showToast } from '@/components/toast';
import { closeModal } from '@/components/modal';
import type { Customer, Product, InventoryTransactionInsert } from '@/types/database.types';

let customers: Customer[] = [];
let products: Product[] = [];
let todayCustomers: Customer[] = []; // customers added for today's session

export async function renderWholesale(): Promise<void> {
  // Load all customers
  if (customers.length === 0) {
    const res = await customerService.getAll();
    if (res.data) customers = res.data;
  }

  // Load products
  if (products.length === 0) {
    const prodRes = await productService.getActive();
    if (prodRes.data) products = prodRes.data.map(p => p as Product);
  }

  renderCustomerSearch();
  await renderCustomerCards();
}

function renderCustomerSearch(): void {
  const container = document.getElementById('customerListScroll');
  const searchInput = document.getElementById('customerSearchInput') as HTMLInputElement | null;
  if (!container || !searchInput) return;

  // Clone to remove old listeners
  const newInput = searchInput.cloneNode(true) as HTMLInputElement;
  searchInput.parentNode?.replaceChild(newInput, searchInput);

  newInput.addEventListener('input', () => {
    renderCustomerList(newInput.value.trim().toLowerCase());
  });

  renderCustomerList('');
}

function renderCustomerList(filter: string): void {
  const container = document.getElementById('customerListScroll');
  if (!container) return;
  container.innerHTML = '';

  const filtered = customers.filter(c =>
    !filter || c.name.toLowerCase().includes(filter)
  );

  if (filtered.length === 0 && filter) {
    container.innerHTML = '<div class="cl-empty">No match. Use "+ Add New" below.</div>';
    return;
  }

  filtered.forEach(cust => {
    const alreadyAdded = todayCustomers.some(c => c.id === cust.id);
    const row = document.createElement('div');
    row.className = 'cl-row' + (alreadyAdded ? ' cl-added' : '');
    row.innerHTML = `
      <span class="cl-name">${cust.name}</span>
      <span class="cl-status">${alreadyAdded ? '✓ Added' : 'Tap to add'}</span>
    `;
    if (!alreadyAdded) {
      row.addEventListener('click', () => addCustomerToday(cust));
    }
    container.appendChild(row);
  });
}

function addCustomerToday(customer: Customer): void {
  if (todayCustomers.some(c => c.id === customer.id)) return;
  todayCustomers.unshift(customer); // Add to top
  renderCustomerSearch();
  renderCustomerCards();
}

async function renderCustomerCards(): Promise<void> {
  const list = document.getElementById('wholesaleCustomerList');
  if (!list) return;
  list.innerHTML = '';

  if (todayCustomers.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-sec);padding:20px">Select customers above to start recording sales.</p>';
    return;
  }

  // Fetch today's transactions to show existing quantities
  const date = AppState.getDate();
  const txRes = await inventoryService.getDailyTransactions(date);
  const txByCustomer = new Map<string, Map<number, number>>();
  if (txRes.data) {
    txRes.data
      .filter(tx => tx.customer_id && tx.transaction_type === 'sold' && tx.sale_type === 'wholesale')
      .forEach(tx => {
        if (!txByCustomer.has(tx.customer_id!)) txByCustomer.set(tx.customer_id!, new Map());
        const map = txByCustomer.get(tx.customer_id!)!;
        map.set(tx.product_id!, (map.get(tx.product_id!) || 0) + tx.quantity);
      });
  }

  const prices = await priceService.getAllCurrentPrices();
  const priceMap = new Map<number, number>();
  if (prices.data) {
    prices.data.forEach(p => priceMap.set(p.product_id, p.wholesale_price));
  }

  todayCustomers.forEach((cust, idx) => {
    const custTx = txByCustomer.get(cust.id) || new Map();
    let subtotal = 0;
    custTx.forEach((qty, pid) => { subtotal += qty * (priceMap.get(pid) || 0); });

    const card = document.createElement('div');
    card.className = 'customer-card';
    card.innerHTML = `
      <div class="customer-header" data-idx="${idx}">
        <span class="customer-name">${cust.name}</span>
        <span class="customer-subtotal">${formatCurrency(subtotal)}</span>
        <button class="customer-toggle" data-idx="${idx}">▾</button>
      </div>
      <div class="customer-body${idx === 0 ? ' open' : ''}" id="custBody_${idx}">
        ${products.map(p => {
          const qty = custTx.get(p.id) || 0;
          const wsPrice = priceMap.get(p.id) || 0;
          return `
            <div class="ws-product-row">
              <span class="ws-product-label">${p.product_name}</span>
              <span class="ws-product-price">₹${wsPrice}</span>
              <input class="ws-qty-input" type="number" min="0"
                     data-custid="${cust.id}" data-pid="${p.id}"
                     value="${qty}" placeholder="0" />
            </div>`;
        }).join('')}
      </div>
    `;
    list.appendChild(card);
  });

  // Toggle expand/collapse
  list.querySelectorAll<HTMLElement>('.customer-header').forEach(h => {
    h.addEventListener('click', () => {
      const idx = h.dataset.idx;
      const body = document.getElementById(`custBody_${idx}`);
      body?.classList.toggle('open');
      const toggle = h.querySelector('.customer-toggle');
      if (toggle && body) toggle.textContent = body.classList.contains('open') ? '▾' : '▸';
    });
  });

  // Input change — record wholesale sale
  list.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('ws-qty-input')) return;
    debounceWholesaleSave(target);
  });
}

let _wsTimer: ReturnType<typeof setTimeout> | null = null;
function debounceWholesaleSave(input: HTMLInputElement): void {
  if (_wsTimer) clearTimeout(_wsTimer);
  _wsTimer = setTimeout(async () => {
    const customerId = input.dataset.custid!;
    const productId = parseInt(input.dataset.pid!);
    const qty = Math.max(0, parseInt(input.value) || 0);

    if (qty <= 0) return;

    const tx: InventoryTransactionInsert = {
      product_id: productId,
      transaction_type: 'sold',
      quantity: qty,
      transaction_date: AppState.getDate(),
      sale_type: 'wholesale',
      customer_id: customerId,
    };

    const res = await inventoryService.recordTransaction(tx);
    if (res.error) {
      showToast(res.error.displayMessage);
    }
  }, 800);
}

export function initWholesaleModal(): void {
  document.getElementById('addCustomerBtn')?.addEventListener('click', () => {
    document.getElementById('addCustomerModal')?.classList.add('open');
    const input = document.getElementById('customerNameInput') as HTMLInputElement;
    if (input) { input.value = ''; setTimeout(() => input.focus(), 100); }
  });

  document.getElementById('cancelCustomerBtn')?.addEventListener('click', () => {
    document.getElementById('addCustomerModal')?.classList.remove('open');
  });

  document.getElementById('confirmCustomerBtn')?.addEventListener('click', addNewCustomer);

  document.getElementById('customerNameInput')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') addNewCustomer();
  });
}

async function addNewCustomer(): Promise<void> {
  const input = document.getElementById('customerNameInput') as HTMLInputElement;
  const name = input?.value.trim();
  if (!name) return;

  const res = await customerService.create({ name, customer_type: 'wholesale' });
  if (res.error) {
    showToast(res.error.displayMessage);
    return;
  }

  if (res.data) {
    customers.unshift(res.data);
    addCustomerToday(res.data);
  }

  closeModal('addCustomerModal');
  showToast(`${name} added`);
}
