/**
 * import-excel.cjs
 * Reads Dairy Products_jul2026_now.xlsx, parses all daily sheets,
 * generates supabase-import.sql.
 *
 * Rules:
 *  - Customer names: use Supabase canonical names (excel spellings mapped below)
 *  - Product names: use Supabase product IDs from products_rows.csv
 *  - Skip anything that isn't a known customer
 *
 * Usage: node import-excel.cjs
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, 'DodlaApp', 'data', 'Dairy Products_jul2026_now.xlsx');
const OUT_SQL    = path.join(__dirname, 'DodlaApp', 'supabase-import.sql');

// ── Supabase product IDs (from products_rows.csv) ────────────────
// Excel column name → Supabase product id
const PRODUCT_ID = {
  'FCM':         1,
  'STD':         2,
  'Milk 200ml':  3,
  'Curd 200ml':  4,
  'Curd 500ml':  5,
  'Curd 5L':     6,
  'Curd 10L':    7,
  'Butter Milk': 8,
  'Buttermilk':  8,
  'Butter milk': 8,
  'Lussi':       9,
  'Lassi':       9,
};

// Column order in wholesale section (cols B-J)
const WS_COLS = ['FCM','STD','Milk 200ml','Curd 500ml','Curd 200ml','Curd 10L','Curd 5L','Butter Milk','Lussi'];
// Column order in retail section (cols K-Q)
const RT_COLS = ['FCM','STD','Milk 200ml','Curd 500ml','Curd 200ml','Butter Milk','Lussi'];

// ── Canonical customer names (as they exist in Supabase) ─────────
// These are the CORRECT names — seeded in supabase-seed.sql
const SUPABASE_CUSTOMERS = [
  'Chendramouli', 'Narayana',      'Laxmana',       'Babu',
  'Pratap',       'Nagaraju',      'Venu',           'Mounika',
  'Malyadri',     'Krishna',       'Ashok',          'Rajesh',
  'Mahesh',       'Ramesh',        'Dinesh',         'Sreenu',
  'Murali',       'Gopal',         'Raju',           'Ramana',
  'Ragaiah',      'Madhu',         'Channaiah',      'Bramhaiah',
  'Kondapa Naidu','Padma',         'Suri',           'Rayudu',
  'Balaiah',      'Sri Hari',      'Kumar',          'Aparna',
  'Mallema',      'Narasimha',     'Raja',           'Gangupenta',
  'Bhashkar',     'Tirupati Reddy','Narayana Reddy', 'Mallikarjuna',
  'Chaitanya',    'Babu M',        'Rambabu',        'K. Sreenu',
  'Madava',       'Mahesh',        'Mali',           'Monika',
  'Chintaladevi',
];

// Build lowercase → canonical lookup for fast matching
const CUST_LOOKUP = new Map();
SUPABASE_CUSTOMERS.forEach(n => CUST_LOOKUP.set(n.toLowerCase(), n));

// ── Excel misspellings → Supabase canonical name ─────────────────
// Add every variant seen in the Excel here
const CUST_ALIASES = {
  // Tirupati Reddy variants
  'tirupati  reddy':  'Tirupati Reddy',
  'tiripati reddy':   'Tirupati Reddy',
  'tiupati reddy':    'Tirupati Reddy',
  'thirupati reddy':  'Tirupati Reddy',
  'tirupapati reddy': 'Tirupati Reddy',
  'tirupti reddy':    'Tirupati Reddy',
  'tirupti  reddy':   'Tirupati Reddy',
  'trupti reddy':     'Tirupati Reddy',
  'tirupat reddy':    'Tirupati Reddy',
  'turupati rddy':    'Tirupati Reddy',
  'tirupai reddy':    'Tirupati Reddy',
  'tirupti reddy':    'Tirupati Reddy',
  // Chendramouli variants
  'chendramouli':     'Chendramouli',
  'chandramouli':     'Chendramouli',
  'chendramoouli':    'Chendramouli',
  'chendramouli':     'Chendramouli',
  'chendrammouli':    'Chendramouli',
  'chendramoli':      'Chendramouli',
  'chedramouli':      'Chendramouli',
  'chendramouli':     'Chendramouli',
  'chendramoui':      'Chendramouli',
  'chendramoulu':     'Chendramouli',
  'chendramoulli':    'Chendramouli',
  'chenndramouli':    'Chendramouli',
  'chendrammmouli':   'Chendramouli',
  'chendra':          'Chendramouli',
  'chandramouli ':    'Chendramouli',
  // Bhashkar variants
  'bhashkar':         'Bhashkar',
  'bhaskar':          'Bhashkar',
  'bhasker':          'Bhashkar',
  // Malyadri variants
  'malyadri':         'Malyadri',
  'malyadr':          'Malyadri',
  'malayadri':        'Malyadri',
  'malydri':          'Malyadri',
  'b.malyadri':       'Malyadri',
  // Laxmana variants
  'laxmana':          'Laxmana',
  'laxman ':          'Laxmana',
  'lamana':           'Laxmana',
  'lxmana':           'Laxmana',
  'koneti laxman ':   'Laxmana',
  // Narayana variants
  'narayana':         'Narayana',
  'nnarayana':        'Narayana',
  'narayana ':        'Narayana',
  'naryana':          'Narayana',
  'narayaa':          'Narayana',
  'narsyana':         'Narayana',
  // Mounika variants
  'mounika':          'Mounika',
  'monika':           'Mounika',
  'mownika':          'Mounika',
  'moumika':          'Mounika',
  // Pratap variants
  'pratap':           'Pratap',
  'pratap ':          'Pratap',
  'pratapp':          'Pratap',
  'prtap':            'Pratap',
  'prata':            'Pratap',
  // Nagaraju variants
  'nagaraju':         'Nagaraju',
  'nagarraju':        'Nagaraju',
  'nagaraju':         'Nagaraju',
  'nagarjj':          'Nagaraju',
  // Channaiah variants
  'channaiah':        'Channaiah',
  'channaia':         'Channaiah',
  'channaih':         'Channaiah',
  'channaiaiah':      'Channaiah',
  'chennaiah':        'Channaiah',
  'channaiah':        'Channaiah',
  'channiah':         'Channaiah',
  'channaiah':        'Channaiah',
  // Raju variants
  'raju':             'Raju',
  'rababu':           'Rambabu',
  'rambabu':          'Rambabu',
  // Narayana Reddy variants
  'narayana reddy':   'Narayana Reddy',
  'narayana reddy ':  'Narayana Reddy',
  // Mallikarjuna variants
  'mallikarjuna':     'Mallikarjuna',
  'malikarjuna':      'Mallikarjuna',
  'malakondaiah':     'Mallikarjuna',
  // Sri Hari
  'sri hari':         'Sri Hari',
  'chintaladevi':     'Chintaladevi',
  'u.n':              null,
  'u n':              null,
};

// Things that look like customer names but aren't
const NOT_CUSTOMERS = new Set([
  'fcm','std','milk 200ml','curd 200ml','curd 500ml','curd 5l','curd 10l',
  'curd 1kg','butter milk','lussi','lassi','buttermilk','butter milk',
  'quantity recevied','yesterdays reamaing','sold today','total available',
  'damaged','dameged /missing','total amount today',
  'wholesale','retail','whoe sale','person name','reguar customers',
  'regular customers','total sold','total amount','today\'s earnings',
  'qu12antity recevied',
]);

function resolveCustomer(raw) {
  if (!raw) return null;
  const name = String(raw).trim();
  if (!name || name.length < 2) return null;

  const lower = name.toLowerCase().trim();

  // Skip known non-customer rows
  if (NOT_CUSTOMERS.has(lower)) return null;

  // Skip rows that look like notes/balances
  if (lower.includes('balance') || lower.includes('paid') ||
      lower.includes('total') || lower.includes('due') ||
      lower.includes('old') || /^\d/.test(lower)) return null;

  // Check aliases first
  if (CUST_ALIASES.hasOwnProperty(lower)) {
    return CUST_ALIASES[lower]; // may be null (intentional skip)
  }

  // Direct match in Supabase customers (case-insensitive)
  if (CUST_LOOKUP.has(lower)) return CUST_LOOKUP.get(lower);

  // Partial match — if excel name starts with a known customer name
  for (const [canonical_lower, canonical] of CUST_LOOKUP) {
    if (lower.startsWith(canonical_lower) || canonical_lower.startsWith(lower)) {
      return canonical;
    }
  }

  // Unknown customer — log it but skip
  return `__UNKNOWN__:${name}`;
}

// ── Date parsing ─────────────────────────────────────────────────
function parseSheetDate(name) {
  const clean = name.replace(/\.\.+/g, '.').trim();
  const parts = clean.split('.');
  if (parts.length < 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (!d || !m || !y) return null;
  const year = y < 100 ? 2000 + y : y;
  const dt   = new Date(year, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function toISO(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function num(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[₹,\s]/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
}

function esc(s) { return String(s || '').replace(/'/g, "''"); }

// ── Parse one daily sheet ────────────────────────────────────────
function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows || rows.length < 4) return [];
  const txns = [];

  // Inventory: find each product row (rows 2-15 approx, col A = product name)
  for (let r = 2; r < Math.min(20, rows.length); r++) {
    const row   = rows[r];
    const label = String(row[0] || '').trim();
    const pid   = PRODUCT_ID[label];
    if (!pid) continue;

    const received = num(row[1]);
    if (received > 0) txns.push({ pid, type:'received', qty:received, sale:'', cust:'' });

    const damaged = num(row[5]);
    if (damaged  > 0) txns.push({ pid, type:'damaged',  qty:damaged,  sale:'', cust:'' });
  }

  // Find wholesale/retail header row
  let wsHdr = -1;
  for (let r = 0; r < rows.length; r++) {
    const r0 = String(rows[r][0] || '').toLowerCase();
    const r1 = String(rows[r][1] || '').toLowerCase();
    if (r0.includes('person') && r1 !== '') { wsHdr = r; break; }
    if (r1.includes('whoe sale') || r1.includes('wholesale')) { wsHdr = r + 1; break; }
  }
  if (wsHdr < 0) return txns;

  // Wholesale + Retail rows
  for (let r = wsHdr + 1; r < rows.length; r++) {
    const row  = rows[r];
    const raw  = String(row[0] || '').trim();
    if (!raw) continue;
    if (raw.toLowerCase().startsWith('total')) break;

    const cust = resolveCustomer(raw);
    if (cust === null) continue;              // intentional skip (UN, etc.)
    if (cust && cust.startsWith('__UNKNOWN__')) continue; // unrecognised — skip

    // Wholesale (cols B-J = index 1-9)
    WS_COLS.forEach((pName, i) => {
      const pid = PRODUCT_ID[pName];
      const qty = num(row[i + 1]);
      if (pid && qty > 0) txns.push({ pid, type:'sold', qty, sale:'wholesale', cust });
    });

    // Retail (cols K-Q = index 10-16) — no customer attached
    RT_COLS.forEach((pName, i) => {
      const pid = PRODUCT_ID[pName];
      const qty = num(row[i + 10]);
      if (pid && qty > 0) txns.push({ pid, type:'sold', qty, sale:'retail', cust:'' });
    });
  }

  return txns;
}

// ── Main ─────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('File not found:', EXCEL_PATH); process.exit(1);
  }

  console.log('Reading:', EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });

  const dated = wb.SheetNames
    .map(n => ({ name: n, dt: parseSheetDate(n) }))
    .filter(x => x.dt !== null)
    .sort((a, b) => a.dt - b.dt);

  console.log(`Sheets: ${wb.SheetNames.length}  Parseable: ${dated.length}`);

  // Parse all sheets
  const unknown = new Set();
  const sheetData = [];
  for (const { name, dt } of dated) {
    try {
      const ws   = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Collect unknowns for logging
      for (let r = 0; r < rows.length; r++) {
        const raw = String(rows[r][0] || '').trim();
        if (raw) {
          const resolved = resolveCustomer(raw);
          if (resolved && resolved.startsWith('__UNKNOWN__')) unknown.add(resolved);
        }
      }

      const txns = parseSheet(ws);
      if (txns.length > 0) sheetData.push({ name, date: toISO(dt), txns });
    } catch(e) {
      console.warn('Error on sheet', name, ':', e.message);
    }
  }

  if (unknown.size > 0) {
    console.log('\nSkipped unknown names (not in Supabase customers):');
    [...unknown].sort().forEach(u => console.log(' ', u.replace('__UNKNOWN__:', '')));
  }

  // Build SQL
  const sql = [];
  sql.push('-- ================================================================');
  sql.push('-- Aarohi Enterprises — Historical Import (Jul 2026 → Now)');
  sql.push('-- Customer names: Supabase canonical names used throughout');
  sql.push('-- Run in: Supabase Dashboard → SQL Editor');
  sql.push('-- ================================================================');
  sql.push('');
  sql.push("DELETE FROM inventory_transactions WHERE transaction_date >= '2026-07-01';");
  sql.push('');
  sql.push('DO $$');
  sql.push('DECLARE');
  // Declare one UUID variable per Supabase customer
  SUPABASE_CUSTOMERS.forEach((c, i) => sql.push(`  cid_${i} UUID; -- ${c}`));
  sql.push('BEGIN');
  sql.push('');
  sql.push('  -- Load Supabase customer IDs once');
  SUPABASE_CUSTOMERS.forEach((c, i) => {
    sql.push(`  SELECT id INTO cid_${i} FROM customers WHERE LOWER(name)=LOWER('${esc(c)}') LIMIT 1;`);
  });
  sql.push('');

  let totalTxns = 0;
  for (const { name, date, txns } of sheetData) {
    sql.push(`  -- ${name} (${date})`);
    for (const t of txns) {
      const saleType = t.sale ? `'${t.sale}'` : 'NULL';
      let custRef = 'NULL';
      let remarks = 'NULL';
      if (t.cust) {
        const idx = SUPABASE_CUSTOMERS.indexOf(t.cust);
        if (idx >= 0) {
          custRef = `cid_${idx}`;
          remarks = `'${esc(t.cust)}'`;
        }
      }
      sql.push(`  INSERT INTO inventory_transactions (product_id,transaction_type,quantity,transaction_date,sale_type,customer_id,remarks) VALUES (${t.pid},'${t.type}',${t.qty},'${date}',${saleType},${custRef},${remarks});`);
      totalTxns++;
    }
    sql.push('');
  }

  sql.push('END $$;');
  sql.push('');
  sql.push('-- Verify');
  sql.push('SELECT COUNT(*) as total, COUNT(DISTINCT transaction_date) as days,');
  sql.push('  MIN(transaction_date) as from_date, MAX(transaction_date) as to_date');
  sql.push('FROM inventory_transactions;');

  fs.writeFileSync(OUT_SQL, sql.join('\n'), 'utf8');

  const lines = sql.length;
  console.log(`\n✓ Generated: ${OUT_SQL}`);
  console.log(`  Days      : ${sheetData.length}`);
  console.log(`  Txns      : ${totalTxns}`);
  console.log(`  SQL lines : ${lines}`);
  console.log('\nNext: Open DodlaApp/supabase-import.sql → paste into Supabase SQL Editor → Run');
}

main();
