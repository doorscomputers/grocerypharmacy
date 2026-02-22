# Tablet Landscape Sales Terminal

## Tasks
- [x] 1. Register TabletSales in navigation (App.tsx)
- [x] 2. Add "Tablet POS" button to Dashboard
- [x] 3. Create TabletSalesScreen.tsx - full two-panel landscape POS screen

## Review

### Changes Made

**App.tsx**
- Added `TabletSales: undefined` to `RootStackParamList`
- Added `import TabletSalesScreen from './screens/TabletSalesScreen'`
- Added `<Stack.Screen name="TabletSales" component={TabletSalesScreen} options={{ headerShown: false }} />`

**DashboardScreen.tsx**
- Added a third PrimaryActionButton "Tablet POS" with icon `monitor` and variant `warning` (orange)
- Navigates to `'TabletSales'`

**screens/TabletSalesScreen.tsx (NEW)**
- Two-panel layout: left (60%) = cart, right (40%) = checkout/payment
- Compact top bar (56px) with back button, title, search, price type toggle, scan/browse/menu buttons
- Left panel: cart items list with FlatList, cart summary with subtotal/discount/total
- Right panel (inline, no modal): discount buttons, customer search, payment method tabs, amount input, quick amounts, remarks, totals breakdown, COMPLETE SALE button
- All existing hooks reused: usePOSCart, usePOSProducts, useAuth, useAppTheme
- All existing modals reused without modification
- Complete shift management (same logic as SalesScreen)
- Complete barcode handling with UPC-A/EAN-13 conversion
- 5 payment methods: Cash, GCash/Maya, Card, Check, Charge Invoice
- Credit limit validation for charge invoices
- Receipt generation with full BIR compliance fields
- Zero changes to existing SalesScreen or any existing components/hooks
