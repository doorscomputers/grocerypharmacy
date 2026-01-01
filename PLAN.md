# Plan: SimplePOS Mobile - Offline Android POS Application

## Project Overview

A simplified, offline-first Point of Sale application for Android tablets and mobile phones. Designed for small businesses like bakeries, restaurants, pharmacies, and small groceries with a few hundred items.

## Key Characteristics

- **Single Business** - No multi-tenant complexity
- **Single Location** - No branch/transfer management
- **Offline-First** - SQLite local database, no internet required
- **Simple Roles** - Admin and Cashier only
- **Core Features Only** - Sales, Purchases, Inventory tracking

---

## Recommended Technology Stack

### Framework: **React Native + Expo**

**Why this stack:**

1. Claude has extensive training on React Native and Expo
2. Single codebase for Android tablets and phones
3. Expo SDK provides native SQLite via `expo-sqlite`
4. TypeScript support (same as current project)
5. Reusable React patterns from ultimatepos-modern
6. Easy build/deploy via Expo EAS Build

### Database: **SQLite via expo-sqlite**

- Local, offline database
- No server required
- Fast for a few hundred items
- Easy backup/export capabilities

### State Management: **Zustand**

- Same as current project
- Lightweight, simple API
- Persists to AsyncStorage for app state

### UI Components: **React Native Paper** or **NativeBase**

- Material Design components
- Good tablet support
- Dark mode built-in

### Navigation: **React Navigation**

- Industry standard for React Native
- Tab and Stack navigation
- Deep linking support

---

## Simplified Database Schema

```sql
-- Users (Admin, Cashier)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'cashier')) NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1
);

-- Products
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT,
  category_id INTEGER REFERENCES categories(id),
  cost_price REAL DEFAULT 0,
  selling_price REAL NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  alert_quantity INTEGER DEFAULT 10,
  unit TEXT DEFAULT 'pc',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  is_active INTEGER DEFAULT 1
);

-- Customers (optional, for credit sales)
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL DEFAULT 0
);

-- Sales
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  subtotal REAL NOT NULL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT CHECK(payment_method IN ('cash', 'credit')) DEFAULT 'cash',
  amount_paid REAL DEFAULT 0,
  change_due REAL DEFAULT 0,
  cashier_id INTEGER REFERENCES users(id),
  status TEXT CHECK(status IN ('completed', 'voided')) DEFAULT 'completed',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sale Items
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  discount REAL DEFAULT 0,
  subtotal REAL NOT NULL
);

-- Purchases
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT CHECK(status IN ('received', 'pending')) DEFAULT 'received',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Items
CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  subtotal REAL NOT NULL
);

-- Stock Adjustments (for corrections)
CREATE TABLE stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id),
  adjustment_type TEXT CHECK(adjustment_type IN ('add', 'subtract', 'set')) NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## Application Structure

```
simplepos-mobile/
├── app/                      # Expo Router screens
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab navigation
│   │   ├── pos.tsx           # POS/Sales screen
│   │   ├── products.tsx      # Product list
│   │   ├── inventory.tsx     # Stock levels
│   │   └── reports.tsx       # Simple reports
│   ├── admin/
│   │   ├── users.tsx
│   │   ├── categories.tsx
│   │   ├── suppliers.tsx
│   │   └── settings.tsx
│   └── _layout.tsx           # Root layout
├── components/
│   ├── ui/                   # Reusable UI components
│   ├── pos/                  # POS-specific components
│   └── forms/                # Form components
├── database/
│   ├── schema.ts             # SQLite schema
│   ├── migrations.ts         # Version migrations
│   └── queries/              # Query functions
├── hooks/
│   ├── useDatabase.ts
│   ├── useAuth.ts
│   └── useCart.ts
├── stores/
│   ├── authStore.ts
│   ├── cartStore.ts
│   └── settingsStore.ts
├── utils/
│   ├── formatters.ts
│   └── calculations.ts
├── CLAUDE.md                 # Instructions for Claude
└── package.json
```

---

## Core Screens

### 1. Login Screen

- Simple username/password
- Remember last user option

### 2. POS Screen (Main)

- Product search/barcode scan
- Quick category filters
- Cart with quantity adjustment
- Payment processing (cash/credit)
- Receipt generation

### 3. Products Screen

- List all products with search
- Add/Edit/Delete products
- Import from CSV (admin only)

### 4. Inventory Screen

- Stock levels at a glance
- Low stock alerts (highlighted)
- Quick stock adjustment

### 5. Purchases Screen

- Record incoming stock
- Supplier selection
- Auto-update product quantities

### 6. Reports Screen (Simple)

- Today's sales summary
- Sales by date range
- Low stock report
- Top selling products

### 7. Admin Screens

- User management
- Category management
- Supplier management
- Business settings (name, receipt header)
- Data backup/restore

---

## CLAUDE.md Template for New Project

This will be created in the new project to guide Claude:

```markdown
# CLAUDE.md - SimplePOS Mobile

## Project Overview

Offline-first POS application for Android tablets/phones using React Native + Expo with SQLite.

## Commands

npm start # Start Expo dev server
npm run android # Run on Android device/emulator
npm run build # Build APK via EAS
npm run lint # ESLint

## Architecture

- **Framework**: React Native + Expo SDK 50+
- **Database**: SQLite via expo-sqlite
- **State**: Zustand with AsyncStorage persistence
- **Navigation**: Expo Router (file-based)
- **UI**: React Native Paper

## Database

- Local SQLite database at app data directory
- Schema in `database/schema.ts`
- All queries in `database/queries/`

## Key Patterns

### Database Access

import \* as SQLite from 'expo-sqlite';
const db = SQLite.openDatabaseSync('simplepos.db');

### Authentication

- Passwords hashed with expo-crypto
- Session stored in Zustand + AsyncStorage
- No JWT/tokens needed (local only)

### Stock Updates

- Sales: Deduct from products.stock_quantity
- Purchases: Add to products.stock_quantity
- Adjustments: Manual corrections with reason

## Roles

- **Admin**: Full access to all features
- **Cashier**: POS, view products, view inventory only

## File Naming

- Screens: PascalCase (ProductList.tsx)
- Components: PascalCase
- Utilities: camelCase
- Database queries: camelCase

## Important Notes

- This is OFFLINE-ONLY, no API calls
- Single business, single location
- Keep UI simple and touch-friendly for tablets
- Large buttons for POS operations
```

---

## User Requirements (Confirmed)

- **Barcode Scanner**: Yes - Use device camera via `expo-camera` + `expo-barcode-scanner`
- **Receipt Printing**: Yes - Bluetooth thermal printer support (58mm/80mm)
- **Project Location**: `C:\Users\Warenski\Desktop\posmobile`
- **Cloud Sync**: Future-ready - Add sync fields to schema for optional cloud backup later

---

## Additional Dependencies for Requirements

```json
{
  "dependencies": {
    "expo": "~50.0.0",
    "expo-sqlite": "~13.0.0",
    "expo-camera": "~14.0.0",
    "expo-barcode-scanner": "~12.0.0",
    "expo-print": "~12.0.0",
    "expo-crypto": "~12.0.0",
    "expo-file-system": "~16.0.0",
    "react-native-ble-plx": "^2.0.0",
    "react-native-paper": "^5.0.0",
    "@react-navigation/native": "^6.0.0",
    "zustand": "^4.0.0",
    "@react-native-async-storage/async-storage": "^1.21.0"
  }
}
```

### Bluetooth Thermal Printing

- Use `react-native-ble-plx` for Bluetooth Low Energy
- Support ESC/POS commands for thermal printers
- Common 58mm (32 chars) and 80mm (48 chars) widths

### Barcode Scanning

- `expo-camera` for camera access
- `expo-barcode-scanner` for decoding barcodes
- Support EAN-13, EAN-8, UPC-A, Code128, QR codes

---

## Updated Schema with Sync Fields

```sql
-- Users (Admin, Cashier)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),  -- For cloud sync
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'cashier')) NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,  -- For cloud sync
  is_dirty INTEGER DEFAULT 0  -- For cloud sync
);

-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Products
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT,
  category_id INTEGER REFERENCES categories(id),
  cost_price REAL DEFAULT 0,
  selling_price REAL NOT NULL,
  stock_quantity REAL DEFAULT 0,  -- Changed to REAL for decimal quantities
  alert_quantity REAL DEFAULT 10,
  unit TEXT DEFAULT 'pc',
  image_uri TEXT,  -- Local image path
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Suppliers
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Customers (for credit sales)
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  balance REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Sales
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  subtotal REAL NOT NULL,
  discount REAL DEFAULT 0,
  discount_type TEXT CHECK(discount_type IN ('fixed', 'percent')) DEFAULT 'fixed',
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT CHECK(payment_method IN ('cash', 'credit', 'gcash', 'card')) DEFAULT 'cash',
  amount_paid REAL DEFAULT 0,
  change_due REAL DEFAULT 0,
  cashier_id INTEGER REFERENCES users(id),
  status TEXT CHECK(status IN ('completed', 'voided', 'held')) DEFAULT 'completed',
  void_reason TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Sale Items
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  cost_price REAL DEFAULT 0,  -- For profit calculation
  discount REAL DEFAULT 0,
  subtotal REAL NOT NULL,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Purchases
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  reference_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT CHECK(status IN ('received', 'pending', 'cancelled')) DEFAULT 'received',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Purchase Items
CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  subtotal REAL NOT NULL,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Stock Adjustments (for corrections)
CREATE TABLE stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  product_id INTEGER REFERENCES products(id),
  adjustment_type TEXT CHECK(adjustment_type IN ('add', 'subtract', 'set')) NOT NULL,
  quantity REAL NOT NULL,
  previous_quantity REAL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  is_dirty INTEGER DEFAULT 0
);

-- Settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sync Log (for tracking sync operations)
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_uuid TEXT NOT NULL,
  operation TEXT CHECK(operation IN ('insert', 'update', 'delete')) NOT NULL,
  synced_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_purchases_date ON purchases(created_at);
CREATE INDEX idx_sync_dirty ON products(is_dirty) WHERE is_dirty = 1;
```

---

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure

1. Initialize Expo project with TypeScript
2. Set up SQLite database and migrations
3. Create database query layer
4. Implement Zustand stores
5. Set up navigation structure

### Phase 2: Authentication & User Management

1. Login screen with PIN or password
2. User CRUD (admin only)
3. Session management
4. Role-based screen access

### Phase 3: Product Management

1. Product list with search
2. Add/Edit product form
3. Barcode scanner integration
4. Category management
5. CSV import for bulk products

### Phase 4: POS Screen

1. Product grid/list view
2. Cart management
3. Quantity adjustment
4. Discount application
5. Payment processing
6. Hold/Recall transactions

### Phase 5: Receipt Printing

1. Bluetooth device pairing
2. ESC/POS command generation
3. Receipt template
4. Print preview on screen

### Phase 6: Purchases & Inventory

1. Purchase order creation
2. Receive stock
3. Stock adjustment screen
4. Low stock alerts
5. Stock report

### Phase 7: Reports

1. Daily sales summary
2. Sales by date range
3. Product sales report
4. Inventory valuation
5. Profit report

### Phase 8: Settings & Backup

1. Business settings (name, address, receipt header)
2. Printer configuration
3. Database backup to file
4. Restore from backup
5. (Future) Cloud sync setup

---

## Project Directory Structure

```
C:\Users\Warenski\Desktop\posmobile\
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # POS Screen (default)
│   │   ├── products.tsx
│   │   ├── inventory.tsx
│   │   ├── purchases.tsx
│   │   └── reports.tsx
│   ├── admin/
│   │   ├── _layout.tsx
│   │   ├── users.tsx
│   │   ├── categories.tsx
│   │   ├── suppliers.tsx
│   │   ├── customers.tsx
│   │   └── settings.tsx
│   ├── product/
│   │   ├── [id].tsx              # Edit product
│   │   └── new.tsx               # Add product
│   ├── sale/
│   │   └── [id].tsx              # Sale details
│   ├── scanner.tsx               # Barcode scanner modal
│   └── _layout.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── NumPad.tsx
│   ├── pos/
│   │   ├── ProductGrid.tsx
│   │   ├── CartList.tsx
│   │   ├── PaymentModal.tsx
│   │   └── ReceiptPreview.tsx
│   ├── scanner/
│   │   └── BarcodeScanner.tsx
│   └── printer/
│       └── BluetoothPrinter.tsx
├── database/
│   ├── index.ts                  # Database initialization
│   ├── schema.ts                 # Table definitions
│   ├── migrations.ts             # Version migrations
│   └── queries/
│       ├── products.ts
│       ├── sales.ts
│       ├── purchases.ts
│       ├── users.ts
│       └── reports.ts
├── hooks/
│   ├── useDatabase.ts
│   ├── useAuth.ts
│   ├── useCart.ts
│   ├── usePrinter.ts
│   └── useScanner.ts
├── stores/
│   ├── authStore.ts
│   ├── cartStore.ts
│   ├── printerStore.ts
│   └── settingsStore.ts
├── utils/
│   ├── formatters.ts
│   ├── calculations.ts
│   ├── escpos.ts                 # ESC/POS command helpers
│   └── backup.ts
├── types/
│   └── index.ts                  # TypeScript types
├── constants/
│   └── index.ts
├── assets/
│   └── images/
├── CLAUDE.md                     # Instructions for Claude
├── app.json                      # Expo config
├── package.json
├── tsconfig.json
└── README.md
```

---

## CLAUDE.md for New Project

This file will guide Claude when working on the posmobile project:

````markdown
# CLAUDE.md - SimplePOS Mobile

## Project Overview

Offline-first POS application for Android tablets/phones using React Native + Expo with SQLite.
Target users: Small businesses (bakery, restaurant, pharmacy, grocery) with a few hundred items.

## Commands

```bash
npm start              # Start Expo dev server
npm run android        # Run on Android device/emulator
npx eas build -p android --profile preview  # Build APK
npm run lint           # ESLint
```
````

## Tech Stack

- **Framework**: React Native + Expo SDK 50+
- **Database**: SQLite via expo-sqlite (synchronous API)
- **State**: Zustand with AsyncStorage persistence
- **Navigation**: Expo Router (file-based)
- **UI**: React Native Paper (Material Design)
- **Camera**: expo-camera + expo-barcode-scanner
- **Printing**: react-native-ble-plx for Bluetooth thermal printers

## Database

- Local SQLite database: `simplepos.db`
- Schema in `database/schema.ts`
- All queries in `database/queries/`
- Sync fields (uuid, synced_at, is_dirty) for future cloud sync

### Database Access Pattern

```typescript
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("simplepos.db");

// Query example
const products = db.getAllSync<Product>(
  "SELECT * FROM products WHERE is_active = 1"
);

// Insert example
db.runSync("INSERT INTO products (name, selling_price) VALUES (?, ?)", [
  name,
  price,
]);
```

## Authentication

- Passwords hashed with expo-crypto (SHA-256)
- Session stored in Zustand + AsyncStorage
- No JWT/tokens needed (local only)
- PIN option for quick login

## Roles

- **Admin**: Full access - users, settings, reports, all CRUD
- **Cashier**: POS only - sales, view products, view inventory

## Stock Updates

- Sales: Deduct from products.stock_quantity
- Purchases: Add to products.stock_quantity
- Adjustments: Manual corrections with reason logged

## Barcode Scanning

```typescript
import { CameraView, useCameraPermissions } from "expo-camera";

// Supported formats: ean13, ean8, upc_a, code128, qr
```

## Bluetooth Printing (ESC/POS)

- Support 58mm (32 chars) and 80mm (48 chars) thermal printers
- ESC/POS commands in `utils/escpos.ts`
- Pair via system Bluetooth settings first

## File Structure

- Screens in `app/` using Expo Router
- Reusable components in `components/`
- Database queries in `database/queries/`
- Business logic in hooks and stores

## UI Guidelines

- Large touch targets (min 48x48 dp) for tablet use
- High contrast colors for visibility
- Bottom tab navigation for main screens
- Modal dialogs for quick actions

## Important Notes

- This is OFFLINE-ONLY, no API calls to external servers
- Single business, single location - no multi-tenant
- Keep UI simple and touch-friendly
- Always handle database errors gracefully
- Test on actual Android tablet for best results

```

```
