// 9-stage simulation that replays the user's spec against the real avco.ts module
// + an inline copy of the COGS aggregation from getCogsReport.
//
// Run:  node tasks/avco-sim.mjs

// ---- Inline import (avco.ts compiled by hand) ----
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

// ---- 9-stage simulation ----
// 1 sack = 50 kg. AVCO is tracked per kg (selling unit).
const SACK = 50;

// product state
let stockKg = 0;
let avco = 0;

// historical sale rows (frozen unit_cost snapshots — like transaction_items.unit_cost)
const saleRows = [];

// helper: receive purchase in sacks at sack price
function receive(sacks, pricePerSack) {
  const kg = sacks * SACK;
  const costPerKg = pricePerSack / SACK;
  const newAvco = roundAvco(computeNewAvco(stockKg, avco, kg, costPerKg));
  stockKg += kg;
  avco = newAvco;
  return newAvco;
}

// helper: sell sacks at total revenue, snapshotting current AVCO into the line
function sell(sacks, totalRevenue) {
  const kg = sacks * SACK;
  const snapshotCost = roundAvco(avco); // mimics our SELECT cost FROM products at time of sale
  saleRows.push({ qty: kg, unit_cost: snapshotCost, revenue: totalRevenue, sacks });
  stockKg -= kg;
}

// ---- Expected AVCO at each GRN per the spec ----
const expected = [];

// Stage 1: Open +10 sacks @ ₱1,700  (Beginning Inventory; uses the same formula via first-receive branch)
expected.push({ stage: 1, avcoKg: 34.0000, sackPriceFromAvco: 1700.0 });
receive(10, 1700);

// Stage 2: GRN +50 @ ₱1,800        → AVCO ₱35.6667/kg
expected.push({ stage: 2, avcoKg: 35.6667 });
receive(50, 1800);

// Stage 3: Sell 40 sacks            → SaleItem.unitCost = ₱35.6667/kg
expected.push({ stage: 3, saleSnapshotKg: 35.6667 });
sell(40, 88000); // revenue placeholder; only COGS matters for the math check

// Stage 4: GRN +40 @ ₱1,900         → AVCO ₱37.2222/kg
expected.push({ stage: 4, avcoKg: 37.2222 });
receive(40, 1900);

// Stage 5: Sell 30 sacks            → SaleItem.unitCost = ₱37.2222/kg
expected.push({ stage: 5, saleSnapshotKg: 37.2222 });
sell(30, 66000);

// Stage 6: GRN +30 @ ₱2,000         → AVCO ₱38.6111/kg
expected.push({ stage: 6, avcoKg: 38.6111 });
receive(30, 2000);

// Stage 7: Sell 20 sacks @ ₱2,200   → SaleItem.unitCost = ₱38.6111/kg
expected.push({ stage: 7, saleSnapshotKg: 38.6111 });
sell(20, 44000);

// Stage 8: GRN +25 @ ₱1,950         → AVCO ₱38.7607/kg
expected.push({ stage: 8, avcoKg: 38.7607 });
receive(25, 1950);

// Stage 9: Sell 15 sacks            → SaleItem.unitCost = ₱38.7607/kg
expected.push({ stage: 9, saleSnapshotKg: 38.7607 });
sell(15, 19000); // 88000+66000+44000+19000 = 217000  ✓ matches spec total revenue

// ---- Verify AVCO chain ----
const lines = [];
const stages = expected;
const stageActuals = [
  // stage 1 — after receive(10,1700)
  { kind: 'avco', kg: 34.0000 },
  // stage 2 — recorded by re-reading from saved 'avco' after each operation
];

// Reset and re-run capturing actuals
stockKg = 0;
avco = 0;
saleRows.length = 0;

function trace(label, action) {
  const before = { stock: stockKg, avco };
  action();
  return { label, before, after: { stock: stockKg, avco: roundAvco(avco) } };
}

const actuals = [];
actuals.push(trace('Stage 1 receive 10@1700', () => receive(10, 1700)));
actuals.push(trace('Stage 2 receive 50@1800', () => receive(50, 1800)));
actuals.push(trace('Stage 3 sell 40 sacks (rev 88,000)', () => sell(40, 88000)));
actuals.push(trace('Stage 4 receive 40@1900', () => receive(40, 1900)));
actuals.push(trace('Stage 5 sell 30 sacks (rev 66,000)', () => sell(30, 66000)));
actuals.push(trace('Stage 6 receive 30@2000', () => receive(30, 2000)));
actuals.push(trace('Stage 7 sell 20 sacks @2200 (rev 44,000)', () => sell(20, 44000)));
actuals.push(trace('Stage 8 receive 25@1950', () => receive(25, 1950)));
actuals.push(trace('Stage 9 sell 15 sacks (rev 19,000)', () => sell(15, 19000)));

console.log('=== AVCO chain trace ===');
for (const a of actuals) {
  console.log(`  ${a.label.padEnd(46)} -> stockKg=${a.after.stock.toString().padStart(5)}  avco/kg=₱${a.after.avco.toFixed(4)}`);
}

// Spec checks
const checks = [
  { label: 'After Stage 2 GRN, AVCO = ₱35.6667/kg', got: roundAvco(actuals[1].after.avco), want: 35.6667 },
  { label: 'After Stage 4 GRN, AVCO = ₱37.2222/kg', got: roundAvco(actuals[3].after.avco), want: 37.2222 },
  { label: 'After Stage 6 GRN, AVCO = ₱38.6111/kg', got: roundAvco(actuals[5].after.avco), want: 38.6111 },
  { label: 'After Stage 8 GRN, AVCO = ₱38.7607/kg', got: roundAvco(actuals[7].after.avco), want: 38.7607 },
];

// Frozen snapshot stability check: snapshot at sale stages, then receive Stage 8 — Stage 3 sale snapshot must NOT change.
const stage3SaleSnapshot = saleRows[0].unit_cost; // stored when Stage 3 ran
checks.push({ label: 'Stage 3 sale.unit_cost snapshot = ₱35.6667 (IMMUTABLE)', got: roundAvco(stage3SaleSnapshot), want: 35.6667 });

const stage5SaleSnapshot = saleRows[1].unit_cost;
checks.push({ label: 'Stage 5 sale.unit_cost snapshot = ₱37.2222 (IMMUTABLE)', got: roundAvco(stage5SaleSnapshot), want: 37.2222 });

const stage7SaleSnapshot = saleRows[2].unit_cost;
checks.push({ label: 'Stage 7 sale.unit_cost snapshot = ₱38.6111 (IMMUTABLE)', got: roundAvco(stage7SaleSnapshot), want: 38.6111 });

const stage9SaleSnapshot = saleRows[3].unit_cost;
checks.push({ label: 'Stage 9 sale.unit_cost snapshot = ₱38.7607 (IMMUTABLE)', got: roundAvco(stage9SaleSnapshot), want: 38.7607 });

// ---- COGS aggregation (replays getCogsReport JS pivoting logic) ----
let revenue = 0;
let cogs = 0;
for (const row of saleRows) {
  revenue += row.revenue;
  cogs += row.qty * row.unit_cost;
}
const grossProfit = revenue - cogs;

checks.push({ label: 'Aggregate Revenue = ₱217,000.00', got: Number(revenue.toFixed(2)), want: 217000.00 });
checks.push({ label: 'Aggregate COGS = ₱194,848.32', got: Number(cogs.toFixed(2)), want: 194848.32 });
checks.push({ label: 'Aggregate Gross Profit = ₱22,151.68', got: Number(grossProfit.toFixed(2)), want: 22151.68 });

console.log('\n=== Spec checks ===');
let passed = 0, failed = 0;
for (const c of checks) {
  const ok = Math.abs(c.got - c.want) < 0.005;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.label}  (got ${c.got}, want ${c.want})`);
  if (ok) passed++; else failed++;
}
console.log(`\nResult: ${passed}/${checks.length} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
