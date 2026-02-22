# Sales Report — Vivid Tabs + Per-Tab Search

## TODO
- [x] Clear search on tab switch
- [x] Remove global search bar card
- [x] Restyle tabs — remove Card wrapper, add "View:" label, bold styling
- [x] Add renderSearchBar helper inside component
- [x] Insert search bars into Products, Categories, and Transactions views
- [x] Add new styles (tabSearchContainer, viewSelectorContainer)

## Review
- **Single file changed**: `screens/SalesReportScreen.tsx`
- **Removed** the global search bar Card that sat above all tabs (confusing on Summary tab)
- **Restyled tabs**: Removed Card wrapper, added a blue-tinted `viewSelectorContainer` with elevation 3, rounded corners, and a bold uppercase "View:" label — tabs now visually stand out from filter cards
- **Added `renderSearchBar` helper**: Reusable inline function that renders a TextInput with magnify icon and clear button
- **Per-tab search bars**: Products ("Search product name or code..."), Categories ("Search category name..."), Details ("Search invoice, customer, cashier...") — Summary has no search bar
- **Search clears on tab switch**: `setSearchQuery('')` added to `onValueChange` so stale queries don't carry over
- **No logic changes**: Existing `searchQuery` filtering in `filteredTransactions`, `salesByProduct`, and `salesByCategory` useMemos remain unchanged
- TypeScript check passed (no new errors)
