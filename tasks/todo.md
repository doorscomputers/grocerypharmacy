# Fix Time Formatting on Receipts and All Transactions

## Problem
1. Receipt time shows garbled Chinese characters (秒, 拝) instead of AM/PM on thermal printer
2. Time display potentially incorrect due to missing `hour12: true` in formatters
3. `toLocaleTimeString('en-PH')` on Android produces non-ASCII characters that thermal printers can't handle

## Todo Items

- [x] Add `formatPrinterTime()` ASCII-safe time formatter to `utils/dateTime.ts`
- [x] Add `formatPrinterDateNumeric()` ASCII-safe date formatter to `utils/dateTime.ts`
- [x] Fix `formatPhilippineDateTime()` and `formatPhilippineTime()` — add `hour12: true`
- [x] Fix all 15 `toLocale*` calls in `escpos.ts` with ASCII-safe formatters
- [x] Fix `POSTransactionCompleteDialog.tsx` thermal print to use `formatPrinterDateTime`
- [x] Add `hour12: true` to all remaining `toLocaleTimeString()` calls across 10+ screens/components

## Review

### Summary
Fixed time formatting across 13 files. Thermal printer output now uses manual ASCII formatting (guaranteed no Chinese characters). All UI/PDF time displays now include `hour12: true` for correct AM/PM.

### Files Changed
1. `utils/dateTime.ts` — Added `formatPrinterTime()`, `formatPrinterDateNumeric()`, fixed hour12
2. `utils/escpos.ts` — Replaced ALL 15 `toLocale*` calls with ASCII-safe formatters
3. `utils/ReceiptPdfService.ts` — Added hour12: true
4. `components/ReceiptPreview.tsx` — Added hour12: true
5. `components/pos/POSTransactionCompleteDialog.tsx` — Switched to formatPrinterDateTime
6. `screens/EJournalReportScreen.tsx` — Added hour12: true
7. `screens/CurrentStockLevelsScreen.tsx` — Added hour12: true
8. `screens/DeliveredItemsReportScreen.tsx` — Added hour12: true
9. `screens/ESalesReportScreen.tsx` — Added hour12: true
10. `screens/PhysicalCountReportScreen.tsx` — Added hour12: true
11. `screens/TopCustomersReportScreen.tsx` — Added hour12: true
12. `screens/ZeroInventoryReportScreen.tsx` — Added hour12: true
13. `screens/ReportsScreen.tsx` — Added hour12: true to 4 locations
