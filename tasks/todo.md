# Add Product Name Search Filter to Physical Count Report

## Tasks
- [x] Add searchQuery state and TextInput search bar to PhysicalCountReportScreen
- [x] Filter sessions to only show those containing matching products
- [x] Filter detail items within expanded sessions by the search query

## Review

### Changes Summary

**`screens/PhysicalCountReportScreen.tsx`**
- Added `useMemo` and `TextInput` imports
- Added `searchQuery` state
- Added `filteredReportData` memo that filters sessions by product name/code match — only shows sessions containing products that match the search, and within those sessions only shows matching product details
- Added search TextInput below the date range filter with magnify icon and clear button
- Shows result count text when search is active (e.g., "3 session(s) with matching products")
- FlatList now uses `filteredReportData` instead of `reportData`
- Added `searchContainer`, `searchInput`, `searchResultText` styles

**Note:** All other inventory reports (Current Stock Levels, Top Selling, Zero Inventory, Item Ledger, Stock Valuation, Damaged Items, Product Transaction) already had product search filters.
