'use strict';

/**
 * scan.js — Barcode scanning + manual product selection, quantity entry.
 */

const Scan = (() => {
  let codeReader = null;
  let scanActive = false;
  let activeScanType = 'received';

  function init() {
    const select = document.getElementById('scanProductSelect');
    if (select.options.length <= 1) {
      Data.getCategories().forEach(cat => {
        const grp = document.createElement('optgroup');
        grp.label = cat;
        Data.getProducts().filter(p => p.category === cat).forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          const prices = Pricing.getPrices(p.id);
          opt.textContent = `${p.name}  (₹${prices.retailPrice})`;
          grp.appendChild(opt);
        });
        select.appendChild(grp);
      });
    }
  }

  function applyCount() {
    const pid = document.getElementById('scanProductSelect').value;
    const qty = parseInt(document.getElementById('qtyInput').value) || 0;

    if (!pid) { showFeedback('Please select a product', false); return; }
    if (qty <= 0) { showFeedback('Enter a quantity > 0', false); return; }

    const day = App.getDay();
    if (!day.inventory[pid]) day.inventory[pid] = App.emptyInv();
    const product = Data.findById(pid);

    if (activeScanType === 'received') {
      day.inventory[pid].received += qty;
    } else if (activeScanType === 'sold') {
      day.inventory[pid].manualSold = (day.inventory[pid].manualSold || 0) + qty;
    } else if (activeScanType === 'damaged') {
      day.inventory[pid].damaged += qty;
    }

    App.syncSoldTotals(day);
    App.recalcInventory(day);
    Storage.saveDay(day);

    showFeedback(`✓ ${product.name} — ${qty} units (${activeScanType}) applied`, true);
    document.getElementById('qtyInput').value = 1;
  }

  function setType(type) { activeScanType = type; }

  function showFeedback(msg, ok) {
    const el = document.getElementById('scanFeedback');
    el.textContent = msg;
    el.className = 'scan-feedback ' + (ok ? 'success' : 'error');
    setTimeout(() => { el.className = 'scan-feedback'; }, 3000);
  }

  // Camera
  async function startCamera() {
    if (typeof ZXing === 'undefined') {
      showFeedback('Barcode library not loaded. Use manual mode.', false);
      return;
    }
    try {
      codeReader = new ZXing.BrowserMultiFormatReader();
      document.getElementById('scannerBox').classList.add('active');
      document.getElementById('startScanBtn').style.display = 'none';
      document.getElementById('stopScanBtn').style.display = 'block';
      scanActive = true;

      const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
      const backCam = devices.find(d => d.label.toLowerCase().includes('back')) || devices[devices.length - 1];

      codeReader.decodeFromVideoDevice(backCam?.deviceId, document.getElementById('scannerVideo'), (result) => {
        if (result && scanActive) handleResult(result.getText());
      });
    } catch (err) {
      showFeedback('Camera error: ' + err.message, false);
      stopCamera();
    }
  }

  function stopCamera() {
    scanActive = false;
    if (codeReader) { codeReader.reset(); codeReader = null; }
    document.getElementById('scannerBox').classList.remove('active');
    document.getElementById('startScanBtn').style.display = 'block';
    document.getElementById('stopScanBtn').style.display = 'none';
  }

  function handleResult(code) {
    const product = Data.findByBarcode(code);
    if (product) {
      stopCamera();
      document.getElementById('scanProductSelect').value = product.id;
      showFeedback(`Scanned: ${product.name} — set quantity and press Apply`, true);
    } else {
      showFeedback(`Unknown barcode: ${code}`, false);
    }
  }

  return { init, applyCount, setType, startCamera, stopCamera };
})();
