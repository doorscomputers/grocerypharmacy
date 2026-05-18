// Verifies the bonus/freebie scenario the user described:
//   Order 10 sacks @ ₱1,900 each = invoice ₱19,000
//   Supplier gives 11 sacks (10 paid + 1 free)
//   Expected: invoice stays at ₱19,000, but AVCO/cost-per-sack equivalent = ₱1,727.27
//
// Run:  node tasks/avco-bonus-sim.mjs

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

// ---- scenario ----
const SACK_TO_KG = 50;

// product state
let stockKg = 0;
let avco = 0;

// receive simulating the exact bonus flow in PurchaseScreen
function receive({ paidSacks, bonusSacks, pricePerSack }) {
  const totalSacks = paidSacks + bonusSacks;
  const totalKg = totalSacks * SACK_TO_KG;
  const invoiceMoney = paidSacks * pricePerSack;
  const effectiveCostPerKg = totalKg > 0 ? invoiceMoney / totalKg : pricePerSack / SACK_TO_KG;
  const newAvco = roundAvco(computeNewAvco(stockKg, avco, totalKg, effectiveCostPerKg));
  stockKg += totalKg;
  avco = newAvco;
  return { invoiceMoney, effectiveCostPerKg, effectiveCostPerSack: effectiveCostPerKg * SACK_TO_KG, newAvco, totalSacks };
}

// Scenario A: pure user example — single delivery 10 paid + 1 bonus
const a = receive({ paidSacks: 10, bonusSacks: 1, pricePerSack: 1900 });

console.log('=== Scenario A: 10 paid + 1 bonus @ ₱1,900 ===');
console.log(`  Invoice total (what supplier bills):  ₱${a.invoiceMoney.toFixed(2)}`);
console.log(`  Total sacks added to stock:           ${a.totalSacks}`);
console.log(`  Effective cost per kg (AVCO):         ₱${a.effectiveCostPerKg.toFixed(4)}`);
console.log(`  Effective cost per sack equivalent:   ₱${a.effectiveCostPerSack.toFixed(4)}`);
console.log(`  products.cost after blend:            ₱${a.newAvco.toFixed(4)} per kg`);

const checks = [
  { label: 'Invoice amount = ₱19,000.00 (NOT 18,999.97)', got: a.invoiceMoney, want: 19000.00 },
  { label: '11 sacks added to inventory',                  got: a.totalSacks, want: 11 },
  { label: 'Effective AVCO ≈ ₱1,727.27/sack',              got: Number(a.effectiveCostPerSack.toFixed(2)), want: 1727.27 },
  { label: 'AVCO per kg ≈ ₱34.5455',                       got: Number(a.newAvco.toFixed(4)), want: 34.5455 },
];

// Scenario B: blending with prior stock
// Start clean. Beginning Inventory 10 sacks @ ₱1,700 (₱34/kg), then receive 10 paid + 1 bonus @ ₱1,900.
stockKg = 0; avco = 0;
const beg = receive({ paidSacks: 10, bonusSacks: 0, pricePerSack: 1700 });
const b = receive({ paidSacks: 10, bonusSacks: 1, pricePerSack: 1900 });

console.log('\n=== Scenario B: Beginning 10@1700, then 10 paid + 1 bonus @ 1900 ===');
console.log(`  After Beginning Inventory AVCO/kg:    ₱${beg.newAvco.toFixed(4)} (expected ₱34.0000)`);
console.log(`  Second delivery invoice:              ₱${b.invoiceMoney.toFixed(2)}`);
console.log(`  Second delivery effective cost/kg:    ₱${b.effectiveCostPerKg.toFixed(4)}`);
console.log(`  New AVCO after blend:                 ₱${b.newAvco.toFixed(4)} per kg`);

// Manual math:
//   prior:  10 sacks * 50 kg = 500 kg @ ₱34.0000  => prior value 17,000
//   new:    11 sacks * 50 kg = 550 kg @ ₱34.5455  => new value 19,000
//   total:  1050 kg, total value 36,000  => 34.2857/kg
const expectedBlend = 36000 / 1050;
checks.push({ label: 'Beginning AVCO = ₱34.0000/kg',           got: Number(beg.newAvco.toFixed(4)), want: 34.0000 });
checks.push({ label: 'Second invoice still = ₱19,000.00',     got: b.invoiceMoney, want: 19000.00 });
checks.push({ label: `Blended AVCO ≈ ₱${expectedBlend.toFixed(4)}/kg`, got: Number(b.newAvco.toFixed(4)), want: Number(expectedBlend.toFixed(4)) });

console.log('\n=== Spec checks ===');
let passed = 0, failed = 0;
for (const c of checks) {
  const ok = Math.abs(c.got - c.want) < 0.005;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.label}  (got ${c.got}, want ${c.want})`);
  if (ok) passed++; else failed++;
}
console.log(`\nResult: ${passed}/${checks.length} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
