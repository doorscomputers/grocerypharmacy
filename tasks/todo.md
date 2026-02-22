# Fix Exchange Screen - Process Exchange Button Cut Off

## TODO
- [x] Step 1: Import `useSafeAreaInsets` and apply bottom inset padding to footer in ExchangeScreen
- [x] Step 2: Apply same fix to RefundScreen which has the identical layout pattern

## Review

### Root Cause
Both screens use `SafeAreaView` from React Native core, which on **Android does NOT handle bottom safe area** (system navigation bar / gesture bar). The footer with action buttons sits behind the Android nav bar, making buttons half-visible and untappable. This is especially bad in landscape mode where vertical space is already limited.

### Files Modified
- **`screens/ExchangeScreen.tsx`** — Added `useSafeAreaInsets` + applied `paddingBottom: Math.max(insets.bottom, 16)` to footer
- **`screens/RefundScreen.tsx`** — Same fix (identical layout pattern had same bug)

### Changes Made
1. Imported `useSafeAreaInsets` from `react-native-safe-area-context` (already in project dependencies)
2. Added `const insets = useSafeAreaInsets()` hook call
3. Applied `paddingBottom: Math.max(insets.bottom, 16)` as inline style on the footer View — this ensures the footer clears the system navigation bar while keeping a minimum 16px padding on devices without bottom insets
