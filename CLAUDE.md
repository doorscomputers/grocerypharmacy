# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Workflow Rules (MUST FOLLOW)

1. **First think through the problem**, read the codebase for relevant files, and write a plan to `tasks/todo.md`.
2. **The plan should have a list of todo items** that you can check off as you complete them.
3. **Before you begin working, check in with me** and I will verify the plan.
4. **Then, begin working on the todo items**, marking them as complete as you go.
5. **Please every step of the way** just give me a high level explanation of what changes you made.
6. **Make every task and code change you do as simple as possible.** We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. **Finally, add a review section** to the `todo.md` file with a summary of the changes you made and any other relevant information.
8. **DO NOT BE LAZY. NEVER BE LAZY.** If there is a bug, find the root cause and fix it. NO TEMPORARY FIXES. You are a senior developer. NEVER BE LAZY.
9. **MAKE ALL FIXES AND CODE CHANGES AS SIMPLE AS HUMANLY POSSIBLE.** They should only impact necessary code relevant to the task and nothing else. It should impact as little code as possible. Your goal is to NOT introduce any bugs. IT'S ALL ABOUT SIMPLICITY.
10. **ALWAYS USE THE CLAUDE FRONT END SKILL.** this way all the UI's / Pages will be done correctly and consistently in all pages.
11. **ALWAYS USE THE PESO SIGN IN CURRENCIES AND ALWAYS USE THE PHILIPPINES/MANILA TIME.** In all Transactions, like Created at, Created on, Modifie at, Modified on and in all audit trail time stamps

## Project Overview

This is a BIR-compliant Mobile Point of Sale (POS) system built with React Native and Expo, specifically designed for **grocery stores and other Philippine retail businesses**. The app follows Philippine BIR regulations including Revenue Regulations No. 7-2024 and 11-2024.

### Variable Inventory Management (Multi-Unit Support)

Products support separate **selling units** and **purchase units** with a conversion factor:
- `unit_id` = selling unit (e.g., Kilogram, Piece, Bottle)
- `purchase_unit_id` = purchase/bulk unit (e.g., Sack, Case, Box)
- `conversion_factor` = how many selling units per 1 purchase unit (e.g., 1 Sack = 50 kg)
- Stock is always tracked in **selling units**
- When receiving purchases, quantity is auto-converted: `purchase_qty x conversion_factor`
- Cost is auto-converted to per-selling-unit: `purchase_cost / conversion_factor`
- Default: `conversion_factor = 1`, `purchase_unit_id = NULL` (single-unit products work unchanged)

## Common Commands

### Development

- `npm start` or `npx expo start` - Start development server
- `npx expo start --clear` - Start with cleared cache (recommended when troubleshooting)
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator (macOS only)
- `npm run web` - Run in web browser

### Type Checking & Quality

- `npx tsc --noEmit` - Run TypeScript type checking
- TypeScript is configured with `strict: false` in tsconfig.json for development flexibility

### Build & Deploy

- `npx expo build:android` - Build Android APK
- `npx expo build:ios` - Build iOS app (macOS only)

## Architecture Overview

### Database Layer

- **SQLite Database**: Local storage using expo-sqlite
- **DatabaseService**: Singleton pattern service class (`database/DatabaseService.ts`)
- **Schema Definition**: Centralized schema and types in `database/schema.ts`
- **Type Exports**: All database types are exported from schema (Product, Transaction, User, etc.)
- **BIR Compliance**: Built-in eJournal, Z-Reading, and X-Reading support

### App Structure

- **Navigation**: React Navigation with Stack Navigator
- **State Management**: Local React state (no external state management)
- **UI Library**: React Native Paper with Material Design theme
- **Screen-based Architecture**: Each major function has its own screen component

### Key Screens

- **LoginScreen**: User authentication (demo mode with any password)
- **DashboardScreen**: Main overview with sales statistics
- **SalesScreen**: POS terminal for processing transactions
- **ProductsScreen**: Product catalog management
- **ReportsScreen**: BIR-compliant Z-Reading and X-Reading reports
- **SettingsScreen**: System configuration including BIR details

### BIR Compliance Features

- **Invoice Numbering**: Sequential BIR-compliant invoice numbers (replacing Official Receipts)
- **VAT Calculations**: 12% VAT handling (inclusive/exclusive)
- **Z-Reading**: End-of-day cumulative sales reports
- **X-Reading**: Mid-day inquiry reports (non-resetting)
- **eJournal**: Complete audit trail for all transactions
- **TIN Support**: Tax Identification Number fields for customers and business

### Database Schema Key Points

- **Transactions Table**: BIR-compliant with invoice_number and transaction_number
- **Products Table**: Includes VAT settings (tax_rate, is_vat_inclusive)
- **Users Table**: Role-based access (ADMIN, CASHIER, MANAGER)
- **Settings Table**: Key-value configuration store for BIR details
- **Z/X Readings**: Separate tables for compliance reporting
- **eJournal**: Audit trail table for all system activities

## Development Guidelines

### Database Operations

- Always use DatabaseService.getInstance() for database operations
- Import types from `database/schema` (e.g., `import { Product, Transaction } from '../database/schema'`)
- All database queries should handle SQLite's type safety requirements
- Use proper type casting for database results to avoid `unknown` types

### TypeScript Usage

- Import database types from schema.ts for type safety
- Handle database query results properly to avoid type errors
- Use proper type annotations for component props and state

### BIR Compliance

- All financial calculations must follow Philippine VAT rules (12%)
- Invoice numbers must be sequential and BIR-compliant
- eJournal entries are required for audit trails
- Z-Reading data must be cumulative and never reset
- X-Reading data is for inquiry only and doesn't affect counters

### Mobile Optimization

- All screens are optimized for mobile and tablet use
- Material Design components provide consistent touch interfaces
- Proper contrast ratios maintained for professional appearance
- Responsive layouts for different screen sizes

## Sample Data

The app includes Philippine business sample data:

- Default admin user (username: "admin", any password in demo mode)
- Sample products (Coca Cola, Rice, Cooking Oil, etc.)
- Pre-configured BIR settings for testing

## Demo Credentials

- **Username**: admin
- **Password**: Any password (demo mode)

## Troubleshooting

- Use `npx expo start --clear` if experiencing cache issues
- Check TypeScript errors with `npx tsc --noEmit`
- Ensure Android emulator is running before `npm run android`
- Port conflicts: Expo may suggest alternative ports (accept when prompted)

  ## Project Overview

  Offline-first POS application for Android tablets/phones using React Native + Expo with SQLite.
  Target users: Small businesses (bakery, restaurant, pharmacy, grocery) with a few hundred items.

  ## Commands

  ```bash
  npm start              # Start Expo dev server
  npm run android        # Run on Android device/emulator
  npx eas build -p android --profile preview  # Build APK
  npm run lint           # ESLint

  Tech Stack

  - Framework: React Native + Expo SDK 50+
  - Database: SQLite via expo-sqlite (synchronous API)
  - State: Zustand with AsyncStorage persistence
  - Navigation: Expo Router (file-based)
  - UI: React Native Paper (Material Design)
  - Camera: expo-camera + expo-barcode-scanner
  - Printing: react-native-ble-plx for Bluetooth thermal printers

  Database

  - Local SQLite database: simplepos.db
  - Schema in database/schema.ts
  - All queries in database/queries/
  - Sync fields (uuid, synced_at, is_dirty) for future cloud sync

  Database Access Pattern

  import * as SQLite from 'expo-sqlite';

  const db = SQLite.openDatabaseSync('simplepos.db');

  // Query example
  const products = db.getAllSync<Product>(
    'SELECT * FROM products WHERE is_active = 1'
  );

  // Insert example
  db.runSync(
    'INSERT INTO products (name, selling_price) VALUES (?, ?)',
    [name, price]
  );

  Authentication

  - Passwords hashed with expo-crypto (SHA-256)
  - Session stored in Zustand + AsyncStorage
  - No JWT/tokens needed (local only)
  - PIN option for quick login

  Roles

  - Admin: Full access - users, settings, reports, all CRUD
  - Cashier: POS only - sales, view products, view inventory

  Stock Updates

  - Sales: Deduct from products.stock_quantity
  - Purchases: Add to products.stock_quantity
  - Adjustments: Manual corrections with reason logged

  Barcode Scanning

  import { CameraView, useCameraPermissions } from 'expo-camera';

  // Supported formats: ean13, ean8, upc_a, code128, qr

  Bluetooth Printing (ESC/POS)

  - Support 58mm (32 chars) and 80mm (48 chars) thermal printers
  - ESC/POS commands in utils/escpos.ts
  - Pair via system Bluetooth settings first

  File Structure

  - Screens in app/ using Expo Router
  - Reusable components in components/
  - Database queries in database/queries/
  - Business logic in hooks and stores

  UI Guidelines

  - Large touch targets (min 48x48 dp) for tablet use
  - High contrast colors for visibility
  - Bottom tab navigation for main screens
  - Modal dialogs for quick actions

  Important Notes

  - This is OFFLINE-ONLY, no API calls to external servers
  - Single business, single location - no multi-tenant
  - Keep UI simple and touch-friendly
  - Always handle database errors gracefully
  - Test on actual Android tablet for best results
  ```

# Activate the Device

PS D:\NextJSProj\posmobile\posmobile> node scripts/generate-license.js 816299459fa626b9f6e5541aec3897204b60b5ea40b31cb22fa426a7044df9f3

# Buid APK

Here's your complete build reference:  
 ============================================================ EAS BUILD COMMANDS - IgoroTech POS
============================================================

--- FIRST TIME SETUP (only once) ---
npm install -g eas-cli
eas login
eas init
eas build:configure --platform android

--- BUILD APK (preview/testing) ---
cd D:\NextJSProj\posmobile\posmobile
eas build --platform android --profile preview

--- BUILD APK (production/release) ---
cd D:\NextJSProj\posmobile\posmobile
eas build --platform android --profile production

--- DAILY DEVELOPMENT (no rebuild needed) ---
npx expo start --dev-client

--- REGENERATE NATIVE FILES (if needed) ---
npx expo prebuild --clean

--- USEFUL COMMANDS ---
eas whoami # Check logged-in account
eas build:list # See all your builds
eas build:view # View latest build status

============================================================
WHEN TO REBUILD
============================================================ - Added new native package (camera, BLE, etc.) - Changed app.json plugins or permissions - Updated Expo SDK version

    NO REBUILD NEEDED FOR:
    - Screen changes, UI updates
    - Business logic, database queries
    - Adding JS-only packages

============================================================

Save this somewhere handy. After the first build, you'll mostly just use npx expo start --dev-client for daily development.

eas build --platform android --profile preview │ APK │ Quick testing │  
 ├───────────────────────────────────────────────────────┼────────┼─────────────────────────┤
│ eas build --platform android --profile production-apk │ APK │ Production distribution │
├───────────────────────────────────────────────────────┼────────┼─────────────────────────┤
│ eas build --platform android --profile production │ AAB │ Play Store (later)
