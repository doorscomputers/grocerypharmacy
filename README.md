# Mobile Point of Sale Application

A BIR-compliant Mobile Point of Sale system for Android and iOS, specifically designed for Philippine businesses.

## Features

### Core POS Functionality
- 📱 **Mobile-First Design** - Optimized for tablets and smartphones
- 🛒 **Sales Terminal** - Intuitive touch-based interface for quick transactions
- 📦 **Product Management** - Add, edit, and manage inventory
- 💳 **Multiple Payment Methods** - Cash, Card, Check, Online payments
- 🧾 **Receipt Generation** - Print or share digital receipts

### BIR Compliance (Philippine Requirements)
- ✅ **BIR-Compliant Invoicing** - Updated to 2024 regulations (RR No. 7-2024, RR No. 11-2024)
- 📊 **Z-Reading Reports** - End-of-day cumulative sales reports
- 📈 **X-Reading Reports** - Mid-day inquiry reports (non-resetting)
- 📋 **eJournal** - Complete transaction audit trail
- 🏢 **eSales Reporting** - Monthly BIR eSales portal compatibility
- 🔢 **TIN Validation** - Tax Identification Number verification
- 📄 **Invoice Format** - Proper BIR-compliant invoice format (transitioned from Official Receipts)

### Technical Features
- 💾 **SQLite Database** - Local data storage optimized for mobile
- 🔄 **Offline Operation** - Works without internet connection
- 🎨 **Material Design** - Professional UI with proper contrast ratios
- 🚀 **React Native + Expo** - Cross-platform mobile development
- 🔐 **User Authentication** - Multi-user support with role-based access

## BIR Compliance Status

This POS system complies with the latest 2024 BIR requirements:

- **Revenue Regulations No. 7-2024**: Transition from Official Receipts to Invoices
- **Revenue Regulations No. 11-2024**: Extended compliance deadlines
- **BIR Registration**: Supports ₱5,600 per device registration fee
- **eJournal Requirements**: Complete transaction logging for BIR audit
- **VAT Calculations**: Proper 12% VAT handling (inclusive/exclusive)
- **Sequential Numbering**: BIR-compliant invoice numbering system

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Android Studio (for Android emulator)
- Expo CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd posmobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on Android emulator**
   ```bash
   npm run android
   ```

5. **Run on iOS simulator** (macOS only)
   ```bash
   npm run ios
   ```

### Android Emulator Setup

1. **Install Android Studio**
   - Download from https://developer.android.com/studio
   - Install Android SDK and emulator

2. **Create Virtual Device**
   - Open Android Studio AVD Manager
   - Create a new virtual device (Tablet recommended for POS)
   - Choose Android API 29+
   - Start the emulator

3. **Run the App**
   ```bash
   npm run android
   ```

## Demo Login

Use these credentials to test the application:

- **Username**: `admin`
- **Password**: Any password (demo mode)

## Sample Data

The app includes sample Philippine products:
- Coca Cola, White Bread, Instant Noodles
- Mineral Water, Rice, Cooking Oil
- Banana Chips, Detergent, Shampoo, Toothpaste

Company settings are pre-configured with sample Philippine business data.

## App Structure

```
posmobile/
├── App.tsx                 # Main application entry
├── database/
│   ├── schema.ts           # Database schema and initialization
│   └── DatabaseService.ts  # Database service layer
├── screens/
│   ├── LoginScreen.tsx     # User authentication
│   ├── DashboardScreen.tsx # Main dashboard
│   ├── SalesScreen.tsx     # Sales terminal
│   ├── ProductsScreen.tsx  # Product management
│   ├── ReportsScreen.tsx   # BIR reports (Z/X-Reading)
│   └── SettingsScreen.tsx  # System configuration
└── utils/
    └── SampleData.ts       # Sample data initialization
```

## Database Schema

The SQLite database includes tables for:
- **Products & Categories** - Inventory management
- **Transactions & Items** - Sales data
- **Z/X-Readings** - BIR compliance reports
- **eJournal** - Audit trail
- **Users** - Authentication and roles
- **Settings** - System configuration

## BIR Report Samples

### Z-Reading (End of Day)
```
*** Z-READING ***
Z-Reading #: 001
Date: 2024-12-25
Gross Sales: ₱1,234.56
VAT Amount: ₱131.11
Net Sales: ₱1,103.45
Reset Counter: 1
*** END OF Z-READING ***
```

### X-Reading (Inquiry)
```
*** X-READING ***
Date: 2024-12-25
Time: 14:30:00
Current Invoice: INV00000123
Gross Sales: ₱856.78
Transaction Count: 15
*** END OF X-READING ***
```

## Testing

### Manual Testing Steps

1. **Login** - Use demo credentials
2. **Add Products** - Navigate to Products → Add new items
3. **Make Sales** - Use Sales Terminal to process transactions
4. **Generate Reports** - Create Z-Reading and X-Reading reports
5. **Configure Settings** - Update company and BIR information

### Android Emulator Testing

1. Start Android Studio AVD Manager
2. Launch a tablet emulator (10" recommended)
3. Run `npm run android`
4. Test touch interactions and mobile UI
5. Test landscape/portrait orientations

## Deployment

### Android APK Build

1. **Configure app.json**
   ```bash
   expo build:android
   ```

2. **Generate signed APK**
   ```bash
   expo build:android -t apk
   ```

### iOS App Store Build (macOS only)

1. **Configure app.json**
   ```bash
   expo build:ios
   ```

2. **Submit to App Store**
   ```bash
   expo upload:ios
   ```

## BIR Registration Process

1. **Register POS System**
   - Complete BIR Form
   - Pay ₱5,600 registration fee per device
   - Submit to local BIR office

2. **Update System Settings**
   - Enter BIR Permit Number
   - Configure TIN and Accreditation Number
   - Update company information

3. **Monthly Reporting**
   - Use eSales portal for monthly submissions
   - Export Z-Reading data as required

## Security Features

- Local SQLite encryption
- User role-based access control
- Transaction audit trails
- Secure invoice numbering
- Data backup and restore capabilities

## Support & Documentation

For technical support or BIR compliance questions:
- Check Philippine BIR official guidelines
- Review Revenue Regulations No. 7-2024 and 11-2024
- Consult with your tax advisor for specific compliance requirements

## License

Proprietary software for Philippine businesses. BIR compliance features are specifically designed for Philippine tax requirements.

---

**Important**: This software is designed specifically for Philippine BIR compliance. Ensure all settings are properly configured and validated with your tax advisor before use in production.