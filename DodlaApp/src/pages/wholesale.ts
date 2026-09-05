/**
 * wholesale.ts — Wholesale page: search/add customers, per-customer product quantities.
 */

import { AppState, formatCurrency } from '@/lib/state';
import { customerService, productService, inventoryService, categoryService, customerNotesService } from '@/services';
import { priceService } from '@/services';
import type { NoteType } from '@/types/database.types';
import { showToast } from '@/components/toast';
import { closeModal } from '@/components/modal';
import type { Customer, Product } from '@/types/database.types';

let customers: Customer[] = [];
let products: Product[] = [];
let todayCustomers: Customer[] = []; // customers added for today's session

export async function renderWholesale(): Promise<void> {
  // Load all customers
  if (customers.length === 0) {
    const res = await customerService.getAll();
    if (res.data) customers = res.data;
  }

  // Load products — wholesale only uses Milk/Dairy products
  if (products.length === 0) {
    const catRes = await categoryService.getAll();
    const milkCat = catRes.data?.find(c => c.name.toLowerCase().includes('milk') || c.name.toLowerCase().includes('dairy'));
    if (milkCat) {
      const prodRes = await productService.getByCategory(milkCat.id);
      if (prodRes.data) products = prodRes.data;
    } else {
      // Fallback: load all
      const prodRes = await productService.getActive();
      if (prodRes.data) products = prodRes.data.map(p => p as Product);
    }
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
    container.innerHTML = '<div style="text-align:center;padding:16px;color:#94A3B8;font-size:13px">No match. Use "Add New Customer" below.</div>';
    return;
  }

  filtered.forEach(cust => {
    const alreadyAdded = todayCustomers.some(c => c.id === cust.id);
    const row = document.createElement('div');
    row.className = 'cust-row' + (alreadyAdded ? ' added' : '');
    row.innerHTML = `
      <span class="name">${cust.name}</span>
      <span class="status">${alreadyAdded ? '✓ Added' : 'Tap to add'}</span>
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
    list.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px 16px;font-size:13px">Tap a customer above to start recording their order.</div>';
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
    card.style.cssText = 'background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,0.05);border:1px solid #F1F5F9;margin:0 16px 10px;overflow:hidden';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:#F8FAFC">
        <span class="cust-toggle" data-idx="${idx}" style="font-weight:700;font-size:14px;color:#0F172A;cursor:pointer;flex:1">${cust.name}</span>
        <span style="display:flex;align-items:center;gap:12px">
          <span style="font-size:13px;font-weight:800;color:#0F766E">${formatCurrency(subtotal)}</span>
          <button class="cust-notes-btn" data-custid="${cust.id}" data-custname="${cust.name}"
            style="background:none;border:none;cursor:pointer;color:#94A3B8;display:flex;align-items:center" title="Notes & Balance">
            <i class="ph ph-note-pencil" style="font-size:18px"></i>
          </button>
          <i class="ph ph-caret-down cust-toggle" data-idx="${idx}" style="color:#94A3B8;font-size:14px;cursor:pointer"></i>
        </span>
      </div>
      <div class="${idx === 0 ? '' : 'hidden'}" id="custBody_${idx}" style="padding:8px 16px 12px">
        ${(() => {
          let currentType = '';
          return products.map(p => {
            const qty = custTx.get(p.id) || 0;
            const wsPrice = priceMap.get(p.id) || 0;
            let typeHeader = '';
            const pType = p.product_type || '';
            if (pType && pType !== currentType) {
              currentType = pType;
              typeHeader = `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0F766E;padding:8px 0 2px">${pType}</div>`;
            }
            return `${typeHeader}
              <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0">
                <span style="font-size:14px;color:#334155;font-weight:500;flex:1">${p.product_name}</span>
                <span style="font-size:12px;color:#94A3B8;width:44px;text-align:right;margin-right:10px">₹${wsPrice}</span>
                <input class="ws-qty-input" type="number" min="0"
                       data-custid="${cust.id}" data-pid="${p.id}"
                       value="${qty || ''}" placeholder="0"
                       style="width:56px;height:34px;text-align:center;border:1.5px solid #E2E8F0;border-radius:9px;font-size:14px;font-weight:700;color:#0F172A;outline:none" />
              </div>`;
          }).join('');
        })()}
      </div>
    `;
    list.appendChild(card);
  });

  // Toggle expand/collapse
  list.querySelectorAll<HTMLElement>('.cust-toggle').forEach(h => {
    h.addEventListener('click', () => {
      const idx = h.dataset.idx;
      const body = document.getElementById(`custBody_${idx}`);
      if (body) body.classList.toggle('hidden');
    });
  });

  // Notes/Balance button
  list.querySelectorAll<HTMLElement>('.cust-notes-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openNotesModal(btn.dataset.custid!, btn.dataset.custname!);
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

    // setSoldQuantity handles exact value — including 0 to clear a mistake
    const res = await inventoryService.setSoldQuantity({
      productId,
      date: AppState.getDate(),
      saleType: 'wholesale',
      customerId,
      quantity: qty,
    });
    if (res.error) {
      showToast(res.error.displayMessage);
    } else {
      showToast('Saved');
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

// ═══════════════════════════════════════════════════════════════
//  CUSTOMER NOTES & BALANCE MODAL
// ═══════════════════════════════════════════════════════════════
let activeNoteCustomerId = '';

async function openNotesModal(customerId: string, customerName: string): Promise<void> {
  activeNoteCustomerId = customerId;
  let modal = document.getElementById('notesModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'notesModal';
    modal.className = 'modal-bg';
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'notesModal') modal!.classList.remove('open');
    });
  }

  modal.innerHTML = `
    <div class="modal-box" style="max-height:80vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="title" style="margin-bottom:0">${customerName}</div>
        <button id="notesCloseBtn" style="background:none;border:none;font-size:20px;color:#94A3B8;cursor:pointer"><i class="ph ph-x"></i></button>
      </div>
      <div id="notesBalance" style="padding:12px 14px;background:#F0FDF9;border-radius:12px;margin:8px 0 16px">
        <div style="font-size:12px;color:#64748B">Loading balance…</div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:8px">
        <button class="note-tab" data-type="payment" style="flex:1;height:38px;border-radius:9px;border:1.5px solid #0F766E;background:#0F766E;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Payment</button>
        <button class="note-tab" data-type="note" style="flex:1;height:38px;border-radius:9px;border:1.5px solid #E2E8F0;background:#fff;color:#64748B;font-size:12px;font-weight:700;cursor:pointer">Note</button>
        <button class="note-tab" data-type="balance" style="flex:1;height:38px;border-radius:9px;border:1.5px solid #E2E8F0;background:#fff;color:#64748B;font-size:12px;font-weight:700;cursor:pointer">Set Balance</button>
      </div>

      <input type="number" id="noteAmount" placeholder="Amount ₹" inputmode="decimal"
        style="width:100%;height:44px;padding:0 14px;border:1.5px solid #E2E8F0;border-radius:12px;font-size:15px;font-weight:600;color:#0F172A;background:#F8FAFC;outline:none;margin-bottom:8px" />
      <input type="text" id="noteText" placeholder="Note (optional)"
        style="width:100%;height:44px;padding:0 14px;border:1.5px solid #E2E8F0;border-radius:12px;font-size:14px;color:#0F172A;background:#F8FAFC;outline:none" />

      <button id="noteSaveBtn" style="width:100%;height:46px;border-radius:12px;background:#0F766E;color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:12px">Save Entry</button>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94A3B8;margin:16px 0 6px">History</div>
      <div id="notesHistory"></div>
    </div>
  `;
  modal.classList.add('open');

  let noteType: NoteType = 'payment';
  modal.querySelectorAll<HTMLElement>('.note-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      noteType = tab.dataset.type as NoteType;
      modal!.querySelectorAll<HTMLElement>('.note-tab').forEach(t => {
        t.style.background = '#fff'; t.style.color = '#64748B'; t.style.borderColor = '#E2E8F0';
      });
      tab.style.background = '#0F766E'; tab.style.color = '#fff'; tab.style.borderColor = '#0F766E';
      // Hide amount for pure notes
      const amtEl = document.getElementById('noteAmount') as HTMLElement;
      if (amtEl) amtEl.style.display = noteType === 'note' ? 'none' : 'block';
    });
  });

  document.getElementById('notesCloseBtn')?.addEventListener('click', () => modal!.classList.remove('open'));

  document.getElementById('noteSaveBtn')?.addEventListener('click', async () => {
    const amount = parseFloat((document.getElementById('noteAmount') as HTMLInputElement)?.value) || 0;
    const text = (document.getElementById('noteText') as HTMLInputElement)?.value.trim() || '';
    if (noteType !== 'note' && amount <= 0) { showToast('Enter an amount'); return; }
    if (noteType === 'note' && !text) { showToast('Enter a note'); return; }

    const res = await customerNotesService.addNote({
      customer_id: activeNoteCustomerId,
      note_type: noteType,
      amount,
      note: text,
      note_date: AppState.getDate(),
    });
    if (res.error) { showToast(res.error.displayMessage); return; }
    showToast('Saved');
    (document.getElementById('noteAmount') as HTMLInputElement).value = '';
    (document.getElementById('noteText') as HTMLInputElement).value = '';
    await loadBalanceAndHistory();
  });

  await loadBalanceAndHistory();
}

async function loadBalanceAndHistory(): Promise<void> {
  const balDiv = document.getElementById('notesBalance');
  const histDiv = document.getElementById('notesHistory');

  const balRes = await customerNotesService.getBalance(activeNoteCustomerId);
  if (balDiv && balRes.data) {
    const b = balRes.data;
    const owes = b.balance > 0;
    balDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:4px">
        <span>Total Purchases</span><span>${formatCurrency(b.total_purchases)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:6px">
        <span>Total Paid</span><span>${formatCurrency(b.total_paid)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:${owes ? '#DC2626' : '#0F766E'};border-top:1px solid #D1FAE5;padding-top:6px">
        <span>${owes ? 'Balance Due' : 'Settled'}</span>
        <span>${formatCurrency(Math.abs(b.balance))}</span>
      </div>
    `;
  }

  const notesRes = await customerNotesService.getNotes(activeNoteCustomerId);
  if (histDiv) {
    if (!notesRes.data || notesRes.data.length === 0) {
      histDiv.innerHTML = '<div style="color:#94A3B8;font-size:12px;padding:8px 0">No entries yet</div>';
    } else {
      histDiv.innerHTML = notesRes.data.map(n => {
        const label = n.note_type === 'payment' ? 'Paid' : n.note_type === 'balance' ? 'Balance set' : 'Note';
        const color = n.note_type === 'payment' ? '#0F766E' : n.note_type === 'balance' ? '#D97706' : '#64748B';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F8FAFC">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:${color}">${label}${n.amount ? ' · ' + formatCurrency(n.amount) : ''}</div>
              ${n.note ? `<div style="font-size:12px;color:#94A3B8">${n.note}</div>` : ''}
            </div>
            <span style="font-size:11px;color:#94A3B8">${n.note_date || ''}</span>
          </div>`;
      }).join('');
    }
  }
}
