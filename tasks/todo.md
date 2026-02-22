# Make Sales Terminal (SalesScreen) Fully Responsive

## Task
Convert all hardcoded pixel values in SalesScreen.tsx to use responsive theme values (sp, fs, lo) from useResponsiveTheme().

## Changes
- [x] 1. Update useResponsiveTheme destructuring to include `isPhone`
- [x] 2. Add responsive styles (rs) object with all dynamic overrides
- [x] 3. Apply responsive overrides to Search Section (padding, fonts, button sizes)
- [x] 4. Apply responsive overrides to Cart Section (padding, fonts, empty state)
- [x] 5. Apply responsive overrides to Checkout Section (padding, fonts, button)
- [x] 6. Also updated POSCartItem.tsx for responsive cart items
- [x] 7. Verified no TypeScript errors in modified files

## Review

### Files Modified
1. **screens/SalesScreen.tsx** - Added `rs` responsive styles object and applied as inline overrides
2. **components/pos/POSCartItem.tsx** - Added responsive sizing for index badge, quantity buttons, remove button, and text

### What Changed
- **SalesScreen.tsx**: Created an `rs` (responsive styles) object that computes all sizing from `sp` (spacing), `fs` (font sizes), and `isPhone` flag. Applied as inline style overrides on 20+ JSX elements across search section, cart section, and checkout section.
- **POSCartItem.tsx**: Added responsive `qtyBtnSize` and `indexSize` variables. Applied responsive inline styles for container padding, index badge size, quantity button sizes, font sizes, and remove button size.

### Responsive Scaling Behavior
- **Small phones (320px)**: Everything scales down ~15% for comfortable fit
- **Large phones (414px)**: Base size (current look preserved)
- **Small tablets (600px)**: Scales up ~5% for better visibility
- **Large tablets (900px+)**: Scales up ~12% with larger touch targets

### Key Design Decisions
- Action buttons enforce minimum 44px (WCAG touch target) on phones, grow to 56+ on tablets
- Static StyleSheet kept for structural props (flex, flexDirection, borders, colors)
- Only sizing props (fontSize, padding, width, height) get responsive overrides
- No changes to modal components (already responsive from `lo.modalMaxWidth`)
