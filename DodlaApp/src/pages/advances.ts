/**
 * advances.ts — Advance orders (pre-orders) page.
 * Shows pending orders + a per-item "stock needed" rollup so stock can be
 * arranged, lets you create an advance (money + items) for a saved customer
 * or a walk-in, and mark orders delivered or cancelled.
 */

import { AppState, formatCurrency } from '@/lib/state';
import {
  advanceOrderService, customerService, productService,
  categoryService, priceService,
} from '@/services';
import { showToast } from '@/components/toast';
import type { Customer, Product, AdvanceOrderView } from '@/types/database.types';

let customers: Customer[] = [];
let products: Product[] = [];
let priceMap = new Map<number, number>();

export async function renderAdvances(): Promise<void> {
  if (customers.length === 0) {
    const res = await customerService.getAll();
    if (res.data) customers = res.data;
  }
  if (products.length === 0) {
    // Advances are mostly curd buckets — load dairy, fall back to all active
    const catRes = await categoryService.getAll();
    const milkCat = catRes.data?.find(c =>
      c.name.toLowerCase().includes('milk') || c.name.toLowerCase().includes('dairy'));
    if (milkCat) {
      const p = await productService.getByCategory(milkCat.id);
      if (p.data) products = p.data;
    } else {
      const p = await productService.getActive();
      if (p.data) products = p.data.map(x => x as Product);
    }
  }
  const prices = await priceService.getAllCurrentPrices();
  priceMap = new Map();
  if (prices.data) prices.data.forEach(p => priceMap.set(p.product_id, p.wholesale_price));

  await renderList();
  bindNewButton();
}

async function renderList(): Promise<void> {
  const rollupEl = document.getElementById('advRollup');
  const listEl = document.getElementById('advList');
  if (!rollupEl || !listEl) return;

  rollupEl.innerHTML = '<div style="padding:12px 16px;color:#64748B;font-size:13px">Loading…</div>';
  listEl.innerHTML = '';

  const [rollupRes, listRes] = await Promise.all([
    advanceOrderService.pendingItemRollup(),
    advanceOrderService.list('pending'),
  ]);

  // Per-item stock-needed rollup
  const rollup = rollupRes.data || [];
  rollupEl.innerHTML = rollup.length === 0
    ? '<div style="padding:12px 16px;color:#64748B;font-size:13px;text-align:center">No pending advances</div>'
    : rollup.map(r => `
        <div class="product-row">
          <div class="info"><span class="name">${r.product_name}</span></div>
          <span style="font-size:14px;font-weight:800;color:#0F766E">${r.total_quantity}</span>
        </div>`).join('');

  // Pending orders
  const orders = listRes.data || [];
  if (orders.length === 0) {
    listEl.innerHTML = '<div style="padding:16px;color:#64748B;font-size:13px;text-align:center">No pending orders. Tap “New Advance” to add one.</div>';
    return;
  }
  listEl.innerHTML = orders.map(renderOrderCard).join('');
  bindOrderActions();
}

function renderOrderCard(o: AdvanceOrderView): string {
  const itemsHtml = o.items.map(i =>
    `<div style="display:flex;justify-content:space-between;font-size:13px;color:#334155;padding:2px 0">
       <span>${i.product_name}</span><span style="font-weight:700">${i.quantity}</span>
     </div>`).join('');
  const remaining = Math.max(0, o.order_total - o.advance_amount);
  return `
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,0.05);border:1px solid #F1F5F9;margin:0 16px 10px;padding:13px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:700;font-size:15px;color:#0F172A">${o.customer_name}</span>
        <span style="font-size:11px;font-weight:700;color:#D97706;background:#FEF3C7;padding:3px 8px;border-radius:20px">Wants ${o.requested_date}</span>
      </div>
      ${itemsHtml}
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;border-top:1px solid #F1F5F9;margin-top:6px;padding-top:6px">
        <span>Order ${formatCurrency(o.order_total)} · Advance ${formatCurrency(o.advance_amount)}${o.paid_full ? ' (full)' : ''}</span>
        <span style="font-weight:700;color:${remaining > 0 ? '#DC2626' : '#0F766E'}">${remaining > 0 ? 'Bal ' + formatCurrency(remaining) : 'Paid'}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="adv-deliver" data-id="${o.id}"
          style="flex:1;height:38px;border-radius:9px;border:none;background:#0F766E;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Mark Delivered</button>
        <button class="adv-cancel" data-id="${o.id}"
          style="height:38px;padding:0 14px;border-radius:9px;border:1.5px solid #FCA5A5;background:#fff;color:#DC2626;font-size:13px;font-weight:700;cursor:pointer">Cancel</button>
      </div>
    </div>`;
}

function bindOrderActions(): void {
  document.querySelectorAll<HTMLElement>('.adv-deliver').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id!);
      const today = AppState.getDate();
      if (!confirm(`Mark order delivered on ${today}? This records the sale and applies the advance as payment.`)) return;
      const res = await advanceOrderService.markDelivered(id, today);
      if (res.error) { showToast(res.error.displayMessage); return; }
      showToast('Delivered');
      await renderList();
    });
  });
  document.querySelectorAll<HTMLElement>('.adv-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id!);
      if (!confirm('Cancel this advance order?')) return;
      const res = await advanceOrderService.cancel(id);
      if (res.error) { showToast(res.error.displayMessage); return; }
      showToast('Cancelled');
      await renderList();
    });
  });
}

// ── Create advance modal ─────────────────────────────────────────
let newBtnBound = false;

function bindNewButton(): void {
  if (newBtnBound) return;
  newBtnBound = true;
  document.getElementById('advNewBtn')?.addEventListener('click', openCreateModal);
}

function openCreateModal(): void {
  let modal = document.getElementById('advCreateModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'advCreateModal';
    modal.className = 'modal-bg';
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'advCreateModal') modal!.classList.remove('open');
    });
  }

  const custOptions = customers
    .map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const itemsHtml = products.map(p => {
    const price = priceMap.get(p.id) || 0;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0">
        <span style="font-size:14px;color:#334155;flex:1">${p.product_name}</span>
        <span style="font-size:12px;color:#64748B;width:44px;text-align:right;margin-right:10px">₹${price}</span>
        <input class="adv-item-input" type="number" min="0" data-pid="${p.id}" placeholder="0"
          style="width:56px;height:34px;text-align:center;border:1.5px solid #E2E8F0;border-radius:9px;font-size:14px;font-weight:700;color:#0F172A;outline:none" />
      </div>`;
  }).join('');

  const tomorrow = AppState.shiftDate(AppState.getDate(), 1);

  modal.innerHTML = `
    <div class="modal-box" style="max-height:88vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="title" style="margin-bottom:0">New Advance Order</div>
        <button id="advCloseBtn" style="background:none;border:none;font-size:20px;color:#64748B;cursor:pointer"><i class="ph ph-x"></i></button>
      </div>

      <label style="font-size:12px;font-weight:700;color:#64748B">Customer</label>
      <select id="advCustSelect" style="width:100%;height:44px;padding:0 12px;border:1.5px solid #E2E8F0;border-radius:12px;font-size:14px;background:#F8FAFC;color:#0F172A;outline:none;margin:4px 0 6px">
        <option value="">— Select saved customer —</option>
        ${custOptions}
      </select>
      <input type="text" id="advWalkinName" placeholder="…or type a new/walk-in name"
        style="width:100%;height:42px;padding:0 12px;border:1.5px solid #E2E8F0;border-radius:12px;font-size:14px;background:#F8FAFC;color:#0F172A;outline:none;margin-bottom:12px" />

      <label style="font-size:12px;font-weight:700;color:#64748B">Delivery date</label>
      <input type="date" id="advReqDate" value="${tomorrow}"
        style="width:100%;height:44px;padding:0 12px;border:1.5px solid #E2E8F0;border-radius:12px;font-size:14px;background:#F8FAFC;color:#0F172A;outline:none;margin:4px 0 12px" />

      <label style="font-size:12px;font-weight:700;color:#64748B">Items requested</label>
      <div style="margin:4px 0 12px">${itemsHtml}</div>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input type="number" id="advAmount" placeholder="Advance ₹" inputmode="decimal"
          style="flex:1;height:44px;padding:0 14px;border:1.5px solid #E2E8F0;border-radius:12px;font-size:15px;font-weight:600;color:#0F172A;background:#F8FAFC;outline:none" />
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#334155;font-weight:600;white-space:nowrap">
          <input type="checkbox" id="advPaidFull" style="width:18px;height:18px" /> Paid full
        </label>
      </div>
      <input type="text" id="advNote" placeholder="Note (optional)"
        style="width:100%;height:42px;padding:0 14px;border:1.5px solid #E2E8F0;border-radius:12px;font-size:14px;color:#0F172A;background:#F8FAFC;outline:none" />

      <button id="advSaveBtn" style="width:100%;height:48px;border-radius:14px;background:#0F766E;color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer;margin-top:14px">Save Advance</button>
    </div>`;

  modal.classList.add('open');
  document.getElementById('advCloseBtn')?.addEventListener('click', () => modal!.classList.remove('open'));
  document.getElementById('advSaveBtn')?.addEventListener('click', () => saveAdvance(modal!));
}

async function saveAdvance(modal: HTMLElement): Promise<void> {
  const selectedId = (document.getElementById('advCustSelect') as HTMLSelectElement)?.value;
  const walkinName = (document.getElementById('advWalkinName') as HTMLInputElement)?.value.trim();
  const requestedDate = (document.getElementById('advReqDate') as HTMLInputElement)?.value;
  const amount = parseFloat((document.getElementById('advAmount') as HTMLInputElement)?.value) || 0;
  const paidFull = (document.getElementById('advPaidFull') as HTMLInputElement)?.checked;
  const note = (document.getElementById('advNote') as HTMLInputElement)?.value.trim() || null;

  if (!requestedDate) { showToast('Pick a delivery date'); return; }

  // Collect items
  const items: Array<{ product_id: number; quantity: number }> = [];
  document.querySelectorAll<HTMLInputElement>('.adv-item-input').forEach(inp => {
    const q = Math.max(0, parseInt(inp.value) || 0);
    if (q > 0) items.push({ product_id: parseInt(inp.dataset.pid!), quantity: q });
  });
  if (items.length === 0) { showToast('Add at least one item'); return; }

  // Resolve customer — use selected, else create a walk-in from the typed name
  let customerId = selectedId;
  if (!customerId) {
    if (!walkinName) { showToast('Select or name a customer'); return; }
    const created = await customerService.create({ name: walkinName, customer_type: 'wholesale' });
    if (created.error || !created.data) { showToast(created.error?.displayMessage ?? 'Could not add customer'); return; }
    customers.unshift(created.data);
    customerId = created.data.id;
  }

  const res = await advanceOrderService.create(
    {
      customer_id: customerId,
      order_date: AppState.getDate(),
      requested_date: requestedDate,
      advance_amount: amount,
      paid_full: paidFull,
      note,
    },
    items
  );
  if (res.error) { showToast(res.error.displayMessage); return; }

  showToast('Advance saved');
  modal.classList.remove('open');
  await renderList();
}
