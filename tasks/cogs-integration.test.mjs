// AVCO + COGS end-to-end integration test against real SQLite (better-sqlite3).
// Replays the production SQL paths from:
//   - InitialInventoryScreen.tsx (Beginning Inventory)
//   - PurchaseScreen.tsx (purchase + AVCO update + bonus handling)
//   - DatabaseService.createTransaction (sale + unit_cost snapshot)
//   - DatabaseService.createSalesReturn (sales return + original cost lookup)
//   - DatabaseService.getCogsReport (aggregation)
//
// Verifies the 9-stage simulation, the bonus/freebie scenario, the immutability of sale cost
// snapshots, and the COGS aggregation across all three views (period, product, category).
//
// Run:  node tasks/cogs-integration.test.mjs

import Database from 'better-sqlite3';

// ---- AVCO formula (same as database/avco.ts) ----
function computeNewAvco(currentQty, currentAvco, incomingQty, incomingCost) {
  const cq = Number(currentQty) || 0;
  const ca = Number(currentAvco) || 0;
  const iq = Number(incomingQty) || 0;
  const ic = Number(incomingCost) || 0;
  if (iq <= 0) return ca;
  if (cq <= 0 || ca <= 0) return ic;
  const totalQty = cq + iq;
  if (totalQty <= 0) return ca;
  return (cq * ca + iq * ic) / totalQty;
}
function roundAvco(value, decimals = 4) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');

// ============================================================================
// SCHEMA — mirrors the relevant CREATE TABLE statements from database/schema.ts
// ============================================================================

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    abbreviation TEXT
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_quantity REAL DEFAULT 0,
    category_id INTEGER,
    unit_id INTEGER,
    purchase_unit_id INTEGER,
    conversion_factor REAL DEFAULT 1,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    balance REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER,
    total_amount DECIMAL(10,2),
    status TEXT
  );

  CREATE TABLE purchase_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    bonus_quantity REAL DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT NOT NULL UNIQUE,
    invoice_number TEXT NOT NULL UNIQUE,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    amount_tendered DECIMAL(10,2) NOT NULL,
    change_amount DECIMAL(10,2) DEFAULT 0,
    cashier_id INTEGER NOT NULL,
    status TEXT CHECK (status IN ('COMPLETED', 'VOID', 'REFUNDED')) DEFAULT 'COMPLETED',
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    price_type TEXT DEFAULT 'retail',
    item_type TEXT DEFAULT 'sale',
    unit_cost DECIMAL(12,4) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT NOT NULL,
    original_transaction_id INTEGER,
    return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2)
  );

  CREATE TABLE sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_return_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(12,4) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    movement_type TEXT,
    quantity REAL NOT NULL,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    reference_type TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ============================================================================
// SEED DATA
// ============================================================================

db.prepare('INSERT INTO users (name) VALUES (?)').run('Cashier');
db.prepare('INSERT INTO categories (id, name) VALUES (1, ?)').run('Rice');
db.prepare('INSERT INTO units (id, name, abbreviation) VALUES (1, ?, ?)').run('Kilogram', 'kg');
db.prepare('INSERT INTO units (id, name, abbreviation) VALUES (2, ?, ?)').run('Sack', 'sack');

// Product: 1 sack = 50 kg, sold per kg. Initial cost/stock are 0 — will be seeded by Beginning Inventory.
db.prepare(
  'INSERT INTO products (id, code, name, price, cost, stock_quantity, category_id, unit_id, purchase_unit_id, conversion_factor, is_active) VALUES (1, ?, ?, ?, 0, 0, 1, 1, 2, 50, 1)'
).run('RICE-001', 'Rice 50kg sack', 44); // ₱44/kg ≈ ₱2200/sack

const PROD = 1;
const KG_PER_SACK = 50;

// ============================================================================
// PRODUCTION SQL HELPERS — exact same operations our screens/DatabaseService run
// ============================================================================

function beginningInventory(productId, qtyInSellingUnits, costPerSellingUnit) {
  // Mirrors InitialInventoryScreen.processInventorySetup()
  db.prepare('UPDATE products SET stock_quantity = ?, cost = ? WHERE id = ?')
    .run(qtyInSellingUnits, costPerSellingUnit, productId);
  if (qtyInSellingUnits > 0) {
    db.prepare(
      `INSERT INTO inventory_movements
       (product_id, movement_type, quantity, unit_cost, reference_type, notes, created_by)
       VALUES (?, 'IN', ?, ?, 'BEGINNING_BALANCE', ?, 1)`
    ).run(productId, qtyInSellingUnits, costPerSellingUnit, `Beginning inventory - AVCO seed at PHP ${costPerSellingUnit.toFixed(4)} per unit`);
  }
}

function purchaseReceive(productId, paidSacks, bonusSacks, unitCostPerSack, poNumber) {
  // Mirrors PurchaseScreen.handleReceivePurchase() with bonus support
  const totalSacks = paidSacks + bonusSacks;
  const invoiceMoney = paidSacks * unitCostPerSack;
  const product = db.prepare(
    'SELECT stock_quantity, cost, COALESCE(conversion_factor, 1) AS conversion_factor FROM products WHERE id = ?'
  ).get(productId);
  const conversionFactor = product.conversion_factor;
  const currentQty = product.stock_quantity;
  const currentAvco = product.cost;
  const totalSellingQty = totalSacks * conversionFactor;
  const effectiveCostPerSellingUnit = totalSellingQty > 0
    ? invoiceMoney / totalSellingQty
    : unitCostPerSack / conversionFactor;

  // Insert purchase header
  const purchaseRes = db.prepare(
    `INSERT INTO purchases (purchase_number, total_amount, status) VALUES (?, ?, 'RECEIVED')`
  ).run(poNumber, invoiceMoney);
  const purchaseId = purchaseRes.lastInsertRowid;

  // Look up product code/name for the detail row
  const prodInfo = db.prepare('SELECT code, name FROM products WHERE id = ?').get(productId);

  db.prepare(
    `INSERT INTO purchase_details
     (purchase_id, product_id, product_code, product_name, quantity_ordered, quantity_received, bonus_quantity, unit_cost, total_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(purchaseId, productId, prodInfo.code, prodInfo.name, paidSacks, paidSacks, bonusSacks, unitCostPerSack, invoiceMoney);

  // AVCO update
  const newAvco = roundAvco(computeNewAvco(currentQty, currentAvco, totalSellingQty, effectiveCostPerSellingUnit));
  db.prepare('UPDATE products SET stock_quantity = ?, cost = ? WHERE id = ?')
    .run(currentQty + totalSellingQty, newAvco, productId);

  db.prepare(
    `INSERT INTO inventory_movements
     (product_id, movement_type, quantity, unit_cost, reference_type, notes, created_by)
     VALUES (?, 'IN', ?, ?, 'PURCHASE', ?, 1)`
  ).run(productId, totalSellingQty, effectiveCostPerSellingUnit, `PO ${poNumber} (${paidSacks} paid + ${bonusSacks} bonus)`);

  return { purchaseId, invoiceMoney, newAvco, effectiveCostPerKg: effectiveCostPerSellingUnit };
}

function sell(productId, sacks, totalRevenue, invNumber, txDate) {
  // Mirrors DatabaseService.createTransaction sale-insert path
  const qty = sacks * KG_PER_SACK;
  const product = db.prepare('SELECT cost FROM products WHERE id = ?').get(productId);
  const unitCostSnapshot = product && product.cost != null ? roundAvco(product.cost) : null;

  const txRes = db.prepare(
    `INSERT INTO transactions
     (transaction_number, invoice_number, subtotal, total_amount, amount_tendered, cashier_id, status, transaction_date)
     VALUES (?, ?, ?, ?, ?, 1, 'COMPLETED', ?)`
  ).run(invNumber, invNumber, totalRevenue, totalRevenue, totalRevenue, txDate);
  const txId = txRes.lastInsertRowid;

  db.prepare(
    `INSERT INTO transaction_items
     (transaction_id, product_id, product_code, product_name, quantity, unit_price, total_amount, item_type, unit_cost)
     VALUES (?, ?, 'RICE-001', 'Rice 50kg sack', ?, ?, ?, 'sale', ?)`
  ).run(txId, productId, qty, totalRevenue / qty, totalRevenue, unitCostSnapshot);

  // OUT movement + stock decrement
  db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?').run(qty, productId);

  return { txId, unitCostSnapshot };
}

function salesReturn(originalTxId, productId, sacks, totalAmount, returnDate, returnNumber) {
  // Mirrors DatabaseService.createSalesReturn — prefers ORIGINAL sale's unit_cost
  const qty = sacks * KG_PER_SACK;
  const origRow = db.prepare(
    'SELECT unit_cost FROM transaction_items WHERE transaction_id = ? AND product_id = ? ORDER BY id ASC LIMIT 1'
  ).get(originalTxId, productId);
  let returnUnitCost = origRow?.unit_cost ?? null;
  if (returnUnitCost == null) {
    const fb = db.prepare('SELECT cost FROM products WHERE id = ?').get(productId);
    returnUnitCost = fb && fb.cost != null ? roundAvco(fb.cost) : null;
  }

  const srRes = db.prepare(
    `INSERT INTO sales_returns (return_number, original_transaction_id, return_date, total_amount) VALUES (?, ?, ?, ?)`
  ).run(returnNumber, originalTxId, returnDate, totalAmount);
  db.prepare(
    `INSERT INTO sales_return_items
     (sales_return_id, product_id, product_code, product_name, quantity, unit_price, total_amount, unit_cost)
     VALUES (?, ?, 'RICE-001', 'Rice 50kg sack', ?, ?, ?, ?)`
  ).run(srRes.lastInsertRowid, productId, qty, totalAmount / qty, totalAmount, returnUnitCost);

  db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(qty, productId);
  return { returnUnitCost };
}

// ============================================================================
// THE ACTUAL getCogsReport SQL (verbatim from DatabaseService.ts)
// ============================================================================
function getCogsReport(startDate, endDate) {
  const tiRows = db.prepare(
    `SELECT
       date(t.transaction_date) AS period,
       ti.product_id,
       ti.product_code,
       ti.product_name,
       CASE WHEN COALESCE(ti.item_type, 'sale') = 'return' THEN -1 ELSE 1 END AS sign,
       ti.quantity AS qty,
       ti.total_amount AS line_amount,
       ti.unit_cost
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     WHERE t.status = 'COMPLETED'
       AND t.transaction_date >= ? AND t.transaction_date <= ?`
  ).all(startDate, endDate);

  const srRows = db.prepare(
    `SELECT
       date(sr.return_date) AS period,
       sri.product_id, sri.product_code, sri.product_name,
       sri.quantity AS qty, sri.total_amount AS line_amount, sri.unit_cost
     FROM sales_return_items sri
     JOIN sales_returns sr ON sr.id = sri.sales_return_id
     WHERE sr.return_date >= ? AND sr.return_date <= ?`
  ).all(startDate, endDate);

  const catRows = db.prepare(
    `SELECT p.id AS product_id, c.id AS category_id, COALESCE(c.name, 'Uncategorized') AS category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id`
  ).all();
  const productCategory = new Map();
  for (const r of catRows) productCategory.set(r.product_id, { id: r.category_id ?? null, name: r.category_name });

  const txCountRow = db.prepare(
    `SELECT COUNT(*) AS c FROM transactions WHERE status = 'COMPLETED' AND transaction_date >= ? AND transaction_date <= ?`
  ).get(startDate, endDate);

  let revenue = 0, cogs = 0, pre_avco_revenue = 0;
  const periodMap = new Map(), productMap = new Map(), categoryMap = new Map();
  const addRow = (period, pid, code, name, signedQty, signedAmount, signedCogs, isPre) => {
    revenue += signedAmount; cogs += signedCogs; if (isPre) pre_avco_revenue += signedAmount;
    const p = periodMap.get(period) || { revenue: 0, cogs: 0 }; p.revenue += signedAmount; p.cogs += signedCogs; periodMap.set(period, p);
    const pr = productMap.get(pid) || { product_code: code, product_name: name, qty: 0, revenue: 0, cogs: 0 };
    pr.qty += signedQty; pr.revenue += signedAmount; pr.cogs += signedCogs; productMap.set(pid, pr);
    const ci = productCategory.get(pid) || { id: null, name: 'Uncategorized' };
    const key = ci.id != null ? `c${ci.id}` : 'cnull';
    const c = categoryMap.get(key) || { category_id: ci.id, category_name: ci.name, revenue: 0, cogs: 0 };
    c.revenue += signedAmount; c.cogs += signedCogs; categoryMap.set(key, c);
  };
  for (const r of tiRows) {
    const sign = Number(r.sign) || 1;
    const qty = (Number(r.qty) || 0) * sign;
    const amount = (Number(r.line_amount) || 0) * sign;
    const hasCost = r.unit_cost != null;
    addRow(r.period, r.product_id, r.product_code, r.product_name, qty, amount, hasCost ? qty * Number(r.unit_cost) : 0, !hasCost);
  }
  for (const r of srRows) {
    const qty = -(Number(r.qty) || 0);
    const amount = -(Number(r.line_amount) || 0);
    const hasCost = r.unit_cost != null;
    addRow(r.period, r.product_id, r.product_code, r.product_name, qty, amount, hasCost ? qty * Number(r.unit_cost) : 0, !hasCost);
  }
  return {
    summary: { revenue, cogs, gross_profit: revenue - cogs, transaction_count: txCountRow.c, pre_avco_revenue },
    by_period: [...periodMap.entries()].map(([period, v]) => ({ period, revenue: v.revenue, cogs: v.cogs, gross_profit: v.revenue - v.cogs })).sort((a, b) => a.period.localeCompare(b.period)),
    by_product: [...productMap.entries()].map(([pid, v]) => ({ product_id: pid, ...v, gross_profit: v.revenue - v.cogs })),
    by_category: [...categoryMap.values()].map(v => ({ ...v, gross_profit: v.revenue - v.cogs })),
  };
}

// ============================================================================
// 9-STAGE SIMULATION (with mid-test bonus, mid-test pre-AVCO snapshot, and a return)
// ============================================================================

const checks = [];
const assert = (label, got, want) => checks.push({ label, got, want, ok: Math.abs(Number(got) - Number(want)) < 0.01 });
const assertExact = (label, got, want) => checks.push({ label, got, want, ok: got === want });

// Stage 1: Beginning Inventory — 10 sacks @ ₱1,700 (₱34/kg)
beginningInventory(PROD, 10 * KG_PER_SACK, 1700 / KG_PER_SACK);
let p = db.prepare('SELECT stock_quantity, cost FROM products WHERE id = ?').get(PROD);
assert('Stage 1 stock = 500 kg', p.stock_quantity, 500);
assert('Stage 1 AVCO = ₱34/kg', p.cost, 34.0);

// Stage 2: GRN +50 @ ₱1,800
const r2 = purchaseReceive(PROD, 50, 0, 1800, 'PO-2');
p = db.prepare('SELECT stock_quantity, cost FROM products WHERE id = ?').get(PROD);
assert('Stage 2 AVCO = ₱35.6667/kg', p.cost, 35.6667);
assert('Stage 2 stock = 3000 kg', p.stock_quantity, 3000);

// Stage 3: Sell 40 sacks @ ₱88,000 (just for revenue accounting)
const s3 = sell(PROD, 40, 88000, 'INV-3', '2026-01-03 10:00:00');
assert('Stage 3 sale.unit_cost = ₱35.6667 (immutable)', s3.unitCostSnapshot, 35.6667);

// Stage 4: GRN +40 @ ₱1,900
purchaseReceive(PROD, 40, 0, 1900, 'PO-4');
p = db.prepare('SELECT cost FROM products WHERE id = ?').get(PROD);
assert('Stage 4 AVCO = ₱37.2222/kg', p.cost, 37.2222);

// Stage 5: Sell 30 sacks @ ₱66,000
const s5 = sell(PROD, 30, 66000, 'INV-5', '2026-01-05 10:00:00');
assert('Stage 5 sale.unit_cost = ₱37.2222', s5.unitCostSnapshot, 37.2222);

// Stage 6: GRN +30 @ ₱2,000
purchaseReceive(PROD, 30, 0, 2000, 'PO-6');
p = db.prepare('SELECT cost FROM products WHERE id = ?').get(PROD);
assert('Stage 6 AVCO = ₱38.6111/kg', p.cost, 38.6111);

// Stage 7: Sell 20 sacks @ ₱44,000
const s7 = sell(PROD, 20, 44000, 'INV-7', '2026-01-07 10:00:00');
assert('Stage 7 sale.unit_cost = ₱38.6111', s7.unitCostSnapshot, 38.6111);

// Stage 8: GRN +25 @ ₱1,950
purchaseReceive(PROD, 25, 0, 1950, 'PO-8');
p = db.prepare('SELECT cost FROM products WHERE id = ?').get(PROD);
assert('Stage 8 AVCO = ₱38.7607/kg', p.cost, 38.7607);

// Stage 9: Sell 15 sacks @ ₱19,000
const s9 = sell(PROD, 15, 19000, 'INV-9', '2026-01-09 10:00:00');
assert('Stage 9 sale.unit_cost = ₱38.7607', s9.unitCostSnapshot, 38.7607);

// ============================================================================
// IMMUTABILITY CHECK — re-read Stage 3 sale AFTER all later AVCO shifts
// ============================================================================
const reReadStage3 = db.prepare(`SELECT unit_cost FROM transaction_items WHERE transaction_id = ?`).get(s3.txId);
assert('Stage 3 sale.unit_cost STILL ₱35.6667 after later shifts (IMMUTABLE)', reReadStage3.unit_cost, 35.6667);

// ============================================================================
// COGS AGGREGATION CHECK — call the actual report SQL
// ============================================================================
const report = getCogsReport('2026-01-01 00:00:00', '2026-01-31 23:59:59');
assert('Report Revenue = ₱217,000', report.summary.revenue, 217000);
assert('Report COGS = ₱194,848.32', report.summary.cogs, 194848.32);
assert('Report Gross Profit = ₱22,151.68', report.summary.gross_profit, 22151.68);
assertExact('Report transaction_count = 4', report.summary.transaction_count, 4);
assertExact('Report pre_avco_revenue = 0', report.summary.pre_avco_revenue, 0);
assertExact('by_period has 4 days', report.by_period.length, 4);
assertExact('by_product has 1 product', report.by_product.length, 1);
assertExact('by_category[0] is Rice', report.by_category[0].category_name, 'Rice');

// ============================================================================
// BONUS / FREEBIE SCENARIO (user's specific question)
// ============================================================================
// Fresh product for clarity
db.prepare('INSERT INTO products (id, code, name, price, cost, stock_quantity, category_id, unit_id, purchase_unit_id, conversion_factor, is_active) VALUES (2, ?, ?, 50, 0, 0, 1, 1, 2, 50, 1)')
  .run('RICE-002', 'Rice 50kg sack v2');

const bonusReceipt = purchaseReceive(2, 10, 1, 1900, 'PO-BONUS');
assertExact('Bonus scenario invoice = ₱19,000 (NOT ₱18,999.97)', bonusReceipt.invoiceMoney, 19000);
const p2 = db.prepare('SELECT stock_quantity, cost FROM products WHERE id = 2').get();
assertExact('Bonus scenario stock = 11 sacks (550 kg)', p2.stock_quantity, 550);
assert('Bonus scenario AVCO = ₱34.5455/kg', p2.cost, 34.5455);
// Invoice amount as stored in purchase_details:
const pd = db.prepare(`SELECT total_amount, quantity_received, bonus_quantity FROM purchase_details WHERE product_id = 2`).get();
assertExact('purchase_details.total_amount = ₱19,000 (invoice)', pd.total_amount, 19000);
assertExact('purchase_details.quantity_received = 10', pd.quantity_received, 10);
assertExact('purchase_details.bonus_quantity = 1', pd.bonus_quantity, 1);

// ============================================================================
// SALES RETURN — verifies that the return reverses at ORIGINAL cost
// ============================================================================
// Return 5 sacks from Stage 3 sale (which was at ₱35.6667/kg)
salesReturn(s3.txId, PROD, 5, 11000, '2026-01-04 09:00:00', 'SR-1');
const reportAfterReturn = getCogsReport('2026-01-01 00:00:00', '2026-01-31 23:59:59');
// Expected change: -11000 revenue, -(5 × 50 × 35.6667) = -8916.675 COGS
const expectedRevenueAfter = 217000 - 11000;
const expectedCogsAfter = 194848.32 - (5 * 50 * 35.6667);
assert('Return: Revenue dropped by ₱11,000', reportAfterReturn.summary.revenue, expectedRevenueAfter);
assert('Return: COGS reversed at ORIGINAL ₱35.6667 (not current AVCO)', reportAfterReturn.summary.cogs, expectedCogsAfter);

// ============================================================================
// PRE-AVCO SCENARIO — sale row with NULL unit_cost should NOT contribute COGS
// ============================================================================
db.prepare(
  `INSERT INTO transactions (transaction_number, invoice_number, subtotal, total_amount, amount_tendered, cashier_id, transaction_date) VALUES (?, ?, ?, ?, ?, 1, ?)`
).run('INV-OLD', 'INV-OLD', 5000, 5000, 5000, '2026-01-10 10:00:00');
const oldTxId = db.prepare('SELECT id FROM transactions WHERE invoice_number = ?').get('INV-OLD').id;
db.prepare(
  `INSERT INTO transaction_items (transaction_id, product_id, product_code, product_name, quantity, unit_price, total_amount, item_type, unit_cost) VALUES (?, ?, ?, ?, 100, 50, 5000, 'sale', NULL)`
).run(oldTxId, PROD, 'RICE-001', 'Rice 50kg sack');
const reportWithPreAvco = getCogsReport('2026-01-01 00:00:00', '2026-01-31 23:59:59');
assert('Pre-AVCO row added ₱5,000 to revenue', reportWithPreAvco.summary.revenue, expectedRevenueAfter + 5000);
assert('Pre-AVCO row contributed 0 to COGS', reportWithPreAvco.summary.cogs, expectedCogsAfter);
assert('Pre-AVCO revenue reported separately = ₱5,000', reportWithPreAvco.summary.pre_avco_revenue, 5000);

// ============================================================================
// PRINT RESULTS
// ============================================================================
console.log('\n=== Integration test results ===');
let passed = 0, failed = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.label}  (got ${c.got}, want ${c.want})`);
  if (c.ok) passed++; else failed++;
}
console.log(`\nResult: ${passed}/${checks.length} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
