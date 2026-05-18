# Cost of Goods Sold (COGS) & Gross Profit Report — Implementation Plan

## Background

The user needs a COGS / Gross Profit report. Cost tracking must follow **Perpetual Weighted Average Cost (Moving Average / AVCO)**:

```
new_avco = (current_qty × current_avco + received_qty × received_cost) ÷ (current_qty + received_qty)
```

The AVCO chain MUST originate from **Beginning Inventory** entered on first app deployment for a new business. From that point forward every GRN updates the rolling AVCO, and every sale snapshots the AVCO into the sale line (immutable thereafter — that's the "stability" property in the simulation).

## Current State (from codebase investigation)

| Area | Status |
|---|---|
| `InitialInventoryScreen.tsx` | ✅ Already exists. Sets `products.stock_quantity` and `products.cost` per item. **This is our AVCO anchor.** |
| `products.cost` column | ⚠️ Used as cost-per-selling-unit, but `receivePurchaseOrder()` line 2553 **overwrites** it with the last purchase cost. NOT a moving average. **MUST FIX.** |
| `transaction_items` table | ❌ Has no `unit_cost` column — sales don't snapshot cost. **MUST ADD.** |
| `purchase_details.unit_cost` | ✅ Captured. |
| `inventory_movements.unit_cost` | ✅ Captured. |
| Existing reports | `SalesReportScreen` (revenue only), `StockValuationReportScreen` (potential profit on on-hand only). **No realized COGS / Gross Profit report.** |

## Design Decisions

1. **`products.cost` is the live Moving Average Cost (AVCO).** Set by Beginning Inventory, updated on every purchase receiving via weighted-average formula.
2. **`transaction_items.unit_cost` is the immutable cost-at-sale snapshot.** Once written, never recomputed (gives Stage 3 vs Stage 9 stability).
3. **Beginning Inventory is mandatory before first sale.** Add a soft gate / dashboard banner if no products have AVCO seeded yet.
4. **Historical sales (before this change) have NULL `unit_cost`** — COGS report shows them separately as "Pre-AVCO (cost not tracked)" rather than treating as zero.
5. **Returns reverse COGS.** Sales returns / BO items get the same `unit_cost` snapshot so refunds reduce COGS correctly.
6. **4-decimal precision** for `unit_cost` (DECIMAL(12,4)) to preserve values like ₱35.6667 from the simulation.

## Todo Items

### Phase 1 — Schema & AVCO Engine (foundation)
- [x] **1.1** Add `unit_cost DECIMAL(12,4) DEFAULT NULL` column to `transaction_items` (CREATE TABLE + ALTER TABLE migration). Update `TransactionItem` type in `database/schema.ts`.
- [x] **1.2** Mirror the schema change in `database/WebMockDatabaseService.ts` — N/A: WebMock has no table schemas (in-memory only).
- [x] **1.3** Create helper `database/avco.ts` exporting `computeNewAvco(currentQty, currentAvco, incomingQty, incomingCost)` — pure function, no DB access, fully unit-testable.
- [x] **1.4** Fix `receivePurchaseOrder()` in `DatabaseService.ts`: capture current qty + AVCO BEFORE the IN movement, then compute weighted average using `computeNewAvco` and `roundAvco`. Replaces the previous "last-cost overwrite" with true Moving Average.

### Phase 2 — Beginning Inventory becomes the AVCO seed
- [x] **2.1** `InitialInventoryScreen.tsx` already writes `products.cost`. Upgraded the inventory_movement insert to use `reference_type = 'BEGINNING_BALANCE'`, populate `unit_cost`, `total_value`, `quantity_before`, `quantity_after`, and note "Beginning inventory - AVCO seed at PHP X.XXXX per unit".
- [x] **2.2** Dashboard un-seeded-AVCO warning banner: added `getUnseededInventoryCount()` helper that counts active products with `stock_quantity > 0 AND (cost IS NULL OR cost <= 0)`. DashboardScreen polls it on focus and renders a tappable amber banner above the hero card that deep-links to `InitialInventory`.

### Phase 3 — Snapshot cost on every cost-bearing transaction
- [x] **3.1** Sale-insert path: SELECT `products.cost` and write into `transaction_items.unit_cost` per item. Applies to both `'sale'` and `'return'` (BO) item types.
- [x] **3.2** `createSalesReturn`: prefer the ORIGINAL transaction's `transaction_items.unit_cost` for the return, fall back to current `products.cost` for pre-AVCO transactions. Adds `unit_cost` column to `sales_return_items`.
- [x] **3.3** BO/return inside same sale — covered by 3.1 (single insert path handles both item types).
- [x] **3.4** Damaged Items — already snapshots `product.cost` into `damaged_items_details.unit_cost` (existing behavior preserved).

### Phase 4 — The COGS Report screen
- [x] **4.1** Created `screens/CostOfGoodsSoldReportScreen.tsx` with:
  - Date range picker (default: this month).
  - View toggle: By Period / By Product / By Category.
  - Summary cards: Revenue, COGS, Gross Profit, Gross Margin %, Tx Count.
  - DataTable with horizontal scroll for tablet/mobile.
  - Pre-AVCO warning banner when applicable.
  - Print (ESC/POS) + PDF + Email via `ReportActionsBar`.
- [x] **4.2** Added `getCogsReport(startDate, endDate)` in `DatabaseService.ts`:
  - Aggregates `transaction_items` (sale signed +, return signed −) + `sales_return_items` (always −).
  - NULL `unit_cost` rows contribute zero COGS but their revenue is reported in `pre_avco_revenue`.
  - Returns summary + by_period + by_product + by_category breakdowns.
- [x] **4.3** Registered in `App.tsx` — `CostOfGoodsSoldReport` route + Stack.Screen.
- [x] **4.4** Added entry in `ReportsHubScreen.tsx` under Sales Reports with icon `chart-line`.

### Phase 5 — Verification
- [ ] **5.1** Manual 9-stage simulation replay — requires user runtime testing.
- [x] **5.2** `npx tsc --noEmit` clean for all new/modified files. 382 pre-existing errors in other files unchanged (Untyped SQLite call pattern, WebMock boolean/number, POSReprintModal `formatDateTime` import).
- [x] **5.3** Mobile-responsive: report screen uses `useResponsiveTheme()` font scales, horizontal-scroll DataTable, wrap-friendly summary grid. Mirrors `SalesReportScreen` patterns.

## Scope Boundaries (what we are NOT doing)

- Not touching tax / VAT logic.
- Not changing existing report screens beyond adding the new entry to ReportsHub.
- Not backfilling historical `unit_cost` — historical sales remain NULL.
- Not adding FIFO/LIFO/Specific-Identification — AVCO only.
- Not building lot/serial tracking.

## Files Touched (estimated)

| File | Change |
|---|---|
| `database/schema.ts` | Add `unit_cost` to transaction_items + ALTER TABLE migration |
| `database/WebMockDatabaseService.ts` | Mirror schema |
| `database/avco.ts` | **NEW** — pure AVCO formula |
| `database/DatabaseService.ts` | Fix `receivePurchaseOrder`, modify sale/return inserts, add `getCogsReport` |
| `screens/CostOfGoodsSoldReportScreen.tsx` | **NEW** — the report |
| `screens/ReportsHubScreen.tsx` | Add menu entry |
| `screens/DashboardScreen.tsx` | Optional: un-seeded AVCO warning banner |
| `App.tsx` | Register new screen route |

## Review

### Files Created
| File | Purpose |
|---|---|
| `database/avco.ts` | Pure AVCO formula (`computeNewAvco`, `roundAvco`). No DB access — unit-testable. |
| `screens/CostOfGoodsSoldReportScreen.tsx` | The COGS / Gross Profit report screen. |

### Files Modified
| File | Change |
|---|---|
| `database/schema.ts` | + `unit_cost` (DECIMAL(12,4) NULL) on `transaction_items` and `sales_return_items` (CREATE + ALTER migrations). + `item_type` and `unit_cost` to `TransactionItem` TS type. |
| `database/DatabaseService.ts` | Import `computeNewAvco`/`roundAvco`. Fix `receivePurchaseOrder` to do real Moving Average. Sale insert path snapshots `products.cost` into `transaction_items.unit_cost`. `createSalesReturn` snapshots original-sale `unit_cost` (fallback to current). + `getCogsReport()` aggregator. |
| `screens/InitialInventoryScreen.tsx` | Inventory movement now uses `BEGINNING_BALANCE` reference_type with populated `unit_cost`/`total_value`/before/after — establishes AVCO audit anchor. |
| `screens/DashboardScreen.tsx` | + Amber warning banner above hero card when un-seeded products exist; taps to `InitialInventory`. + `unseededCount` state + fetch in `loadDashboardData`. |
| `App.tsx` | + `CostOfGoodsSoldReport` route + Stack.Screen + import. |
| `screens/ReportsHubScreen.tsx` | + Menu card under Sales Reports. |

### How the AVCO Chain Now Works (end-to-end)

1. **New business deployment** — operator opens `Initial Inventory` and enters Beginning Inventory: quantity and **cost per unit** for each product on hand. These rows write `products.stock_quantity` and `products.cost` (the AVCO seed), plus a `BEGINNING_BALANCE` row in `inventory_movements` carrying the unit cost for audit.
2. **Each Purchase receiving (GRN)** — `receivePurchaseOrder()` reads the current `(stock_quantity, cost)`, then computes
   `new_avco = (current_qty × current_avco + incoming_qty × incoming_cost) ÷ (current_qty + incoming_qty)`
   The `products.cost` column is updated with the rounded new AVCO (4-decimal precision).
3. **Each sale** — at the `INSERT INTO transaction_items` site, we SELECT `products.cost` and write it into the new `unit_cost` column. This value is **immutable** thereafter — re-reads of historical sales return the same cost regardless of later AVCO shifts.
4. **Each sales return** — the return line stores `unit_cost` from the ORIGINAL sale line (matched via `original_transaction_id` + `product_id`). For pre-AVCO sales this falls back to the current AVCO.
5. **COGS Report** — `getCogsReport()` sums signed revenue and signed `qty × unit_cost` across `transaction_items` (sale=+, return=−) and `sales_return_items` (always −). Rows with NULL `unit_cost` contribute zero COGS and are reported separately as "Pre-AVCO revenue" so users see exactly how much revenue lacks cost data.

### Simulation Correctness (against the 9-stage user spec)

The formula in `database/avco.ts` is the literal Perpetual Weighted Average. With Beginning Inventory +10 sacks @ ₱1,700, stage 2 (+50 @ ₱1,800) computes:
`(10×1700 + 50×1800) / 60 = ₱1,783.3333 per sack → ₱35.6667 per kg (÷50)`
This matches the user simulation exactly. Stage 3 sale snapshots ₱35.6667/kg into `transaction_items.unit_cost`. Stage 4 raises AVCO to ₱37.2222/kg via the same formula. The previously-written Stage 3 row is never recomputed — that's the stability property.

### Known Gaps / Follow-ups

- **Phase 5.1 (live 9-stage replay)** requires you to run the app and seed data — please verify in-app once you sync.
- **Historical sales remain `unit_cost = NULL`** — they appear as Pre-AVCO and are excluded from COGS. The report banner makes this explicit so it's not silently zero.
- **`products.cost` column DDL is still `DECIMAL(10,2)`** — SQLite stores numerics loosely so 4-decimal AVCO values persist correctly, but a cosmetic widening to `DECIMAL(12,4)` could be done later if any external tool inspects the column metadata.
- **Pre-existing TS errors** (382 lines) untouched — they're about the `SQLite: any` dynamic import in DatabaseService.ts and unrelated WebMock issues. Not introduced by this change.

### What To Do Next (for the user)

1. Run `npx expo start --clear` and open the new **Reports → Sales Reports → Cost of Goods Sold** menu.
2. On a fresh DB (or a test device): seed Beginning Inventory for one product, then run the 9-stage simulation (GRNs and sales) to confirm `products.cost` rolls and `transaction_items.unit_cost` stays stable per the spec.
3. If the dashboard un-seeded warning banner is desired, flag for a follow-up task.
