# Testing Guide - Mobile POS Application

## Android Emulator Setup & Testing

### Prerequisites
1. **Android Studio** installed with SDK tools
2. **Java Development Kit (JDK) 11+**
3. **Node.js 18+** and npm
4. **Expo CLI** globally installed: `npm install -g expo-cli`

### Step 1: Create Android Virtual Device (AVD)

1. **Open Android Studio**
   ```bash
   # If not installed, download from:
   # https://developer.android.com/studio
   ```

2. **Open AVD Manager**
   - Click "More Actions" → "AVD Manager"
   - Or go to Tools → AVD Manager

3. **Create New Virtual Device**
   - Click "Create Virtual Device"
   - **Device Category**: Tablet (recommended for POS)
   - **Device**: Pixel C (10.2" tablet) or similar
   - **System Image**: API 29+ (Android 10+)
   - **Configuration**:
     - RAM: 2048 MB minimum
     - Internal Storage: 2048 MB
     - SD Card: 512 MB (optional)

4. **Start Emulator**
   - Click the play button next to your AVD
   - Wait for Android to fully boot

### Step 2: Install and Run the POS App

1. **Navigate to Project Directory**
   ```bash
   cd /path/to/posmobile
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm start
   # or
   npx expo start
   ```

4. **Run on Android**
   ```bash
   npm run android
   # or
   npx expo start --android
   ```

### Step 3: Manual Testing Checklist

#### 1. Login Screen Testing
- [ ] App loads without crashes
- [ ] Login form displays properly
- [ ] Demo login works (username: "admin", any password)
- [ ] Navigation to Dashboard after successful login
- [ ] UI elements have proper contrast (white text on blue background)

#### 2. Dashboard Testing
- [ ] Today's stats display correctly (initially 0)
- [ ] Quick action cards are clickable and properly sized
- [ ] Navigation to all screens works
- [ ] FAB (Floating Action Button) for Quick Sale works
- [ ] Cards display in 2x2 grid on tablet/phone

#### 3. Sales Terminal Testing
- [ ] Product search functionality
- [ ] Add products to cart
- [ ] Quantity adjustment (+ and - buttons)
- [ ] Remove items from cart
- [ ] VAT calculations are correct (12%)
- [ ] Checkout process completes
- [ ] Receipt generation works
- [ ] Transaction saves to database

**Sample Test Transaction:**
1. Search for "Coca Cola"
2. Add 2 items to cart
3. Add "White Bread" 1 item
4. Verify totals: Subtotal + 12% VAT = Total
5. Checkout with ₱100 cash
6. Verify change calculation
7. Complete transaction

#### 4. Product Management Testing
- [ ] Product list loads (should show 10 sample products)
- [ ] Search functionality works
- [ ] Add new product dialog opens
- [ ] Form validation works (required fields)
- [ ] Product creation saves successfully
- [ ] Product cards display all information clearly

**Sample New Product:**
- Code: TEST001
- Name: Test Product
- Price: ₱50.00
- Stock: 25
- Unit: pcs

#### 5. BIR Reports Testing
- [ ] Today's summary shows transaction data
- [ ] X-Reading generation works
- [ ] Z-Reading generation (only once per day)
- [ ] Report dialogs display properly
- [ ] Print/Share functionality works
- [ ] Transaction list displays recent sales

**Test Sequence:**
1. Complete 2-3 sales transactions first
2. Generate X-Reading (should show current day sales)
3. Generate Z-Reading (should show cumulative data)
4. Verify reports contain BIR-compliant information

#### 6. Settings Testing
- [ ] All setting categories load
- [ ] Edit dialog opens for each setting
- [ ] Changes save successfully
- [ ] Company information updates
- [ ] BIR configuration works
- [ ] Data management options display

**Update These Settings:**
- Company Name: "Your Test Store"
- TIN: "123-456-789-000"
- Address: Your test address

#### 7. Mobile UI/UX Testing
- [ ] Touch targets are appropriately sized (minimum 44px)
- [ ] Text is readable on mobile screen
- [ ] No horizontal scrolling issues
- [ ] Keyboard doesn't block input fields
- [ ] Navigation is intuitive
- [ ] Loading states display properly

#### 8. Database Testing
- [ ] Data persists after app restart
- [ ] SQLite operations complete without errors
- [ ] Invoice numbering is sequential
- [ ] Z-Reading counters are cumulative
- [ ] eJournal entries are created for transactions

### Step 4: Advanced Testing

#### Performance Testing
1. **Large Dataset Test**
   - Add 50+ products
   - Process 20+ transactions
   - Verify app remains responsive

2. **Memory Usage**
   - Monitor Android Studio's profiler
   - Check for memory leaks during navigation

#### Landscape Mode Testing
1. Rotate emulator to landscape
2. Verify UI adapts properly
3. Test all screens in both orientations

#### Network Connectivity
1. Disable internet connection
2. Verify app works offline
3. Test local SQLite operations

### Step 5: Common Issues & Solutions

#### Issue: "Port 8081 is being used"
**Solution:**
```bash
# Kill existing Metro processes
npx react-native start --reset-cache
# or
lsof -ti:8081 | xargs kill -9
```

#### Issue: "Android emulator not detected"
**Solution:**
1. Ensure emulator is fully booted
2. Check `adb devices` shows connected emulator
3. Restart Metro bundler

#### Issue: "SQLite database errors"
**Solution:**
1. Clear app data in emulator settings
2. Restart the development server
3. Check database schema initialization

#### Issue: "Navigation errors"
**Solution:**
1. Verify all screen components are properly imported
2. Check navigation parameter types
3. Ensure screens are registered in navigator

### Step 6: Production Testing Simulation

#### BIR Compliance Verification
1. **Test Invoice Numbering**
   - Create 10 consecutive transactions
   - Verify sequential invoice numbers (INV00000001, INV00000002, etc.)

2. **Test Z-Reading Workflow**
   - Process sales throughout the day
   - Generate Z-Reading at end of day
   - Verify cumulative counter increments
   - Confirm cannot generate multiple Z-Readings per day

3. **Test VAT Calculations**
   - Mix VAT-inclusive and VAT-exclusive products
   - Verify 12% VAT rate is applied correctly
   - Check receipt breakdown shows VAT amount

#### Multi-User Testing
1. Test with different user roles (if implemented)
2. Verify cashier permissions
3. Test user authentication flows

### Step 7: Bug Reporting

If you encounter issues, report with:
1. **Environment**: Android version, device/emulator specs
2. **Steps to reproduce**: Detailed step-by-step
3. **Expected vs Actual**: What should happen vs what happened
4. **Screenshots**: Visual evidence of issues
5. **Console logs**: React Native debugger output

### Performance Benchmarks

Target performance metrics:
- **App startup**: < 3 seconds
- **Screen navigation**: < 500ms
- **Database queries**: < 200ms
- **Transaction processing**: < 1 second
- **Report generation**: < 2 seconds

### Accessibility Testing

Verify:
- [ ] Text contrast ratios meet WCAG guidelines
- [ ] Touch targets are minimum 44x44 pixels
- [ ] Important UI elements have proper labels
- [ ] Navigation is logical and consistent

This testing guide ensures your Mobile POS application works correctly on Android devices and meets Philippine BIR compliance requirements.