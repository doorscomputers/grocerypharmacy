# Invoice Picker Customer Search + Tappable Qty Input

## Task
1. Add customer name search/filter to the Browse Invoices tab in POSInvoiceListPicker
2. Make quantity values tappable for manual input in Exchange and Refund modals

## Changes
- [x] 1. Add customer name filter TextInput in POSInvoiceListPicker Browse tab
- [x] 2. Make qty tappable in POSExchangeModal (return items + new items)
- [x] 3. Make qty tappable in POSRefundModal (refund items)

## Review

### Files Modified
1. **components/pos/POSInvoiceListPicker.tsx** - Added customer name filter input in Browse tab with clear button, filters invoices client-side
2. **components/pos/POSExchangeModal.tsx** - Made return qty and new item qty tappable to show TextInput for manual entry
3. **components/pos/POSRefundModal.tsx** - Made refund qty tappable to show TextInput for manual entry

### What Changed
- **POSInvoiceListPicker**: Added `customerFilter` state. Below the date presets, a search row with account-search icon and TextInput filters the loaded invoices by customer name (client-side). Shows "X of Y Invoices Found" when filter is active. Clear button appears when text is entered.
- **POSExchangeModal**: Qty values for return items and new items are now wrapped in TouchableOpacity. Tapping shows a TextInput with the current value pre-selected. On blur, the value is clamped to valid range and the input reverts to text display.
- **POSRefundModal**: Same tappable qty pattern for refund quantity values.
