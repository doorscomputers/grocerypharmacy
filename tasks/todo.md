# Variable Inventory Management (Multi-Unit Support)

## Overview
Add purchase unit, selling unit, and conversion factor to products so grocery stores can buy in bulk (sacks, cases, boxes) and sell in smaller units (kg, pieces, bottles).

## Steps

- [x] Step 1: Update `database/schema.ts` - Add `purchase_unit_id` and `conversion_factor` to products interface, CREATE TABLE, and ALTER TABLE migrations
- [x] Step 2: Update `database/DatabaseService.ts` - Update `getProductsWithDetails()`, `createProductWithDetails()`, `updateProductWithDetails()` to include new fields
- [x] Step 3: Update `database/DatabaseService.ts` - Apply conversion factor in `receivePurchaseOrder()`
- [x] Step 4: Update `database/WebMockDatabaseService.ts` - Mirror changes for web mock
- [x] Step 5: Update `screens/ProductsScreen.tsx` - Add purchase unit dropdown, conversion factor input, rename "Unit of Measure" to "Selling Unit"
- [x] Step 6: Update `screens/PurchaseScreen.tsx` - Apply conversion factor when receiving purchases
- [x] Step 7: Update `CLAUDE.md` - Add grocery/retail store focus and multi-unit support notes

## Review

### Summary of Changes

1. **database/schema.ts**
   - Added `purchase_unit_id?: number` and `conversion_factor: number` to products interface
   - Added `purchase_unit_id INTEGER` and `conversion_factor REAL DEFAULT 1` to CREATE TABLE
   - Added FOREIGN KEY reference for `purchase_unit_id` to units table
   - Changed `stock_quantity` from `INTEGER DEFAULT 0` to `REAL DEFAULT 0` for decimal quantities
   - Added ALTER TABLE migrations for existing databases

2. **database/DatabaseService.ts**
   - `getProductsWithDetails()`: Added second LEFT JOIN on units table (aliased `pu`) for purchase unit name/abbreviation
   - `createProductWithDetails()`: Added `purchase_unit_id` and `conversion_factor` to type definition and INSERT statement
   - `updateProductWithDetails()`: Added `purchase_unit_id` and `conversion_factor` to type definition and dynamic SET clause
   - `receivePurchaseOrder()`: Fetches product's `conversion_factor`, multiplies received quantity by it, divides cost by it

3. **database/WebMockDatabaseService.ts**
   - `createProduct()`: Resolves `purchase_unit_name` and `purchase_unit_abbreviation`, sets `conversion_factor`
   - `updateProduct()`: Resolves purchase unit names on update

4. **screens/ProductsScreen.tsx**
   - Added `purchase_unit_name`, `purchase_unit_abbreviation` to Product interface
   - Added `purchase_unit_id` and `conversion_factor` to formData, resetForm, emptyForm, and edit population
   - Added `'purchase_unit'` to activeDropdown type union
   - Renamed "Unit of Measure" label to "Selling Unit"
   - Added "Purchase Unit (Bulk)" dropdown button and modal
   - Added "Conversion Factor" text input (only visible when purchase unit is set)
   - Conversion factor label dynamically shows: "1 {purchase_unit} = ? {selling_unit}"
   - Added validation: conversion factor must be > 0
   - Changed stock_quantity parse from `parseInt` to `parseFloat` for decimal support

5. **screens/PurchaseScreen.tsx**
   - Updated stock update logic to fetch `conversion_factor` from product
   - Multiplies purchase quantity by conversion factor for stock update
   - Divides unit cost by conversion factor for per-selling-unit cost
   - Inventory movement notes show conversion details when factor > 1

6. **CLAUDE.md**
   - Updated Project Overview to specify grocery stores and retail businesses
   - Added "Variable Inventory Management" section documenting multi-unit support

### What Does NOT Change
- Sales flow (sales work in selling units, no changes needed)
- POS cart, payment, receipts
- All reports (already display stock in selling units)
- Existing products (default conversion_factor=1 and purchase_unit_id=NULL)
