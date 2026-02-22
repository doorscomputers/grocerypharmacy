# Fix Date Filter on Customer Account Statement

## Task 1: Fix UTC timezone bug in date filtering
- [x] `CustomerAccountStatementScreen.tsx` — `loadDateRangeData()` SQL filter params
- [x] `ReportsScreen.tsx` — `generateInventoryHistoryReport()` SQL filter params
- [x] `TopCustomersReportScreen.tsx` — date filter SQL string building
- [x] `SupplierAccountStatementScreen.tsx` — `getDateRange()` helper used for all date presets

## Task 2: Move DateRangeFilter below tabs, hidden for SOA
- [x] Remove DateRangeFilter from above tabs (old position)
- [x] Place it below the tab selector, hidden for SOA tab via `display: 'none'`
- [x] SOA tab shows all unpaid invoices (no date filtering) — filter is hidden
- [x] Purchases, Payments, Returns, Summary tabs — filter is visible and filters data
- [x] Using `display: 'none'` instead of conditional render to keep the component mounted (preserves selected preset state across tab switches)

## Review

### Task 1: UTC Bug
Replaced `toISOString().split('T')[0]` (UTC) with local-time formatting using `getFullYear()/getMonth()/getDate()` in 4 files. This produces correct YYYY-MM-DD strings in Philippine local time.

### Task 2: Date Filter Placement
Moved the DateRangeFilter from above all tabs to below the tab selector. It's now hidden when on the SOA tab (which shows all unpaid invoices regardless of date) and visible for Purchases/Payments/Returns/Summary tabs. The component stays mounted via `display: 'none'` to preserve the user's selected date preset when switching between tabs.

### Files Modified
- **`screens/CustomerAccountStatementScreen.tsx`** — Moved DateRangeFilter below tabs, hidden for SOA
- **`screens/ReportsScreen.tsx`** — UTC date fix
- **`screens/TopCustomersReportScreen.tsx`** — UTC date fix
- **`screens/SupplierAccountStatementScreen.tsx`** — UTC date fix
