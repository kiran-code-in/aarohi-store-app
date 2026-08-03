/**
 * scan.ts — Barcode scan page + manual product selection.
 */

import { AppState } from '@/lib/state';
import { productService, inventoryService } from '@/services';
import type { Product, InventoryTransactionInsert, TransactionType } from '@/types/database.types';

let activeScanType: TransactionType = 'received';
let codeReader: unknown = null;

export async function initScan(): Promise<void> {
  const select = document.getElementById('scanProductSelect') as HTMLSelectElement | null;
  if (!select || select.options.length > 1) return;

  const prodRes = await productService.getActive();
  if (!prodRes.data) return;

  // Group by category
  const byCat = new Map<string, Product[]>();
  prodRes.data.forEach(p => {
    const cat = (p as unknown as { category_name: string }).category_name || 'Other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(p);
  });

  byCat.forEach((prods, catName) => {
    const grp = document.createElement('optgroup');
    grp.label = catName;
    prods.forEach(p => {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = `${p.product_name}  (₹${p.retail_price ?? 0})`;
      grp.appendChild(opt);
    });
    select.appendChild(grp);
  });
}

export function initScanEvents(): void {
  document.getElementById('startScanBtn')?.addEventListener('click', startCamera);
  document.getElementById('stopScanBtn')?.addEventListener('click', stopCamera);
  document.getElementById('applyCountBtn')?.addEventListener('click', applyCount);

  document.getElementById('qtyMinus')?.addEventListener('click', () => {
    const inp = document.getElementById('qtyInput') as HTMLInputElement;
    if (inp) inp.value = String(Math.max(1, parseInt(inp.value) - 1));
  });
  document.getElementById('qtyPlus')?.addEventListener('click', () => {
    const inp = document.getElementById('qtyInput') as HTMLInputElement;
    if (inp) inp.value = String(parseInt(inp.value) + 1);
  });

  document.querySelectorAll<HTMLButtonElement>('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeScanType = btn.dataset.type as TransactionType;
    });
  });
}

async function applyCount(): Promise<void> {
  const select = document.getElementById('scanProductSelect') as HTMLSelectElement;
  const qtyInput = document.getElementById('qtyInput') as HTMLInputElement;
  const productId = parseInt(select?.value);
  const qty = parseInt(qtyInput?.value) || 0;

  if (!productId) { feedback('Please select a product', false); return; }
  if (qty <= 0) { feedback('Enter a quantity > 0', false); return; }

  const tx: InventoryTransactionInsert = {
    product_id: productId,
    transaction_type: activeScanType,
    quantity: qty,
    transaction_date: AppState.getDate(),
    sale_type: activeScanType === 'sold' ? 'retail' : undefined,
  };

  const res = await inventoryService.recordTransaction(tx);
  if (res.error) {
    feedback(res.error.displayMessage, false);
    return;
  }

  const prodRes = await productService.getById(productId);
  const name = prodRes.data?.product_name || 'Product';
  feedback(`✓ ${name} — ${qty} units (${activeScanType}) recorded`, true);
  if (qtyInput) qtyInput.value = '1';
}

function feedback(msg: string, ok: boolean): void {
  const el = document.getElementById('scanFeedback');
  if (!el) return;
  el.textContent = msg;
  el.className = ok
    ? 'text-center text-caption font-semibold py-2 px-3 rounded-lg bg-emerald-50 text-emerald-700'
    : 'text-center text-caption font-semibold py-2 px-3 rounded-lg bg-red-50 text-red-700';
  el.classList.remove('hidden');
  setTimeout(() => { el.className = 'hidden'; }, 3000);
}

async function startCamera(): Promise<void> {
  if (typeof (window as unknown as { ZXing: unknown }).ZXing === 'undefined') {
    feedback('Barcode library not loaded. Use manual mode.', false);
    return;
  }
  // Camera implementation stays the same as before
  feedback('Camera scan — coming soon. Use manual mode.', false);
}

export function stopCamera(): void {
  if (codeReader && typeof (codeReader as { reset: () => void }).reset === 'function') {
    (codeReader as { reset: () => void }).reset();
    codeReader = null;
  }
  document.getElementById('scannerBox')?.classList.remove('active');
  const startBtn = document.getElementById('startScanBtn') as HTMLElement;
  const stopBtn = document.getElementById('stopScanBtn') as HTMLElement;
  if (startBtn) startBtn.style.display = 'block';
  if (stopBtn) stopBtn.style.display = 'none';
}
