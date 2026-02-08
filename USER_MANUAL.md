# IgoroTech Mobile POS System
# Complete User Manual & Tutorial

**Version 1.0**
**BIR-Compliant Point of Sale System for Philippine Businesses**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Making Sales (POS Terminal)](#4-making-sales-pos-terminal)
5. [Product Management](#5-product-management)
6. [Inventory Management](#6-inventory-management)
7. [Customer Management](#7-customer-management)
8. [Supplier & Purchase Management](#8-supplier--purchase-management)
9. [Reports & BIR Compliance](#9-reports--bir-compliance)
10. [User Management & Permissions](#10-user-management--permissions)
11. [Settings & Configuration](#11-settings--configuration)
12. [Bluetooth Printing](#12-bluetooth-printing)
13. [Backup & Data Management](#13-backup--data-management)
14. [Troubleshooting](#14-troubleshooting)
15. [Quick Reference Card](#15-quick-reference-card)

---

# 1. Introduction

## What is IgoroTech Mobile POS?

IgoroTech Mobile POS is a **BIR-compliant** Point of Sale system designed specifically for Philippine businesses. It runs on Android tablets and phones, works completely **offline** (no internet required), and includes all features needed for retail operations including:

- Sales processing with multiple payment methods
- Complete inventory tracking
- Customer and supplier management
- BIR-compliant reporting (Z-Reading, X-Reading, eJournal)
- Bluetooth thermal printer support
- VAT calculations (12% with vatable/exempt/zero-rated options)

## Who Should Use This Manual?

- **Business Owners**: Learn how to set up and manage your POS system
- **Cashiers**: Learn how to process daily sales transactions
- **Managers**: Learn how to run reports and manage inventory

## System Requirements

- Android phone or tablet (Android 8.0 or higher recommended)
- Bluetooth thermal printer (58mm or 80mm paper width)
- Storage space: At least 100MB free

---

# 2. Getting Started

## 2.1 First-Time Login

When you open the app for the first time:

1. You'll see the **Login Screen**
2. Enter your credentials:
   - **Username**: admin (default)
   - **Password**: admin123 (default - change this immediately!)
3. Tap **"Login"**

```
┌─────────────────────────────────┐
│     IgoroTech Mobile POS        │
│                                 │
│   Username: [admin          ]   │
│   Password: [**********     ]   │
│                                 │
│        [ LOGIN ]                │
│                                 │
└─────────────────────────────────┘
```

## 2.2 Understanding User Roles

The system has three user roles:

| Role | Access Level | Typical User |
|------|--------------|--------------|
| **Admin** | Full system access - all features, settings, users | Business Owner |
| **Manager** | Business operations - sales, inventory, reports | Store Manager |
| **Cashier** | Sales only - process transactions, view products | Sales Staff |

## 2.3 Initial Setup Checklist

Before using the POS, complete these setup steps:

- [ ] Change the default admin password (Settings > User Profile)
- [ ] Enter your business information (Settings > Business Info)
- [ ] Enter BIR registration details (Settings > BIR Settings)
- [ ] Add your products (Products menu)
- [ ] Set up categories for products (Master Data > Categories)
- [ ] Configure your Bluetooth printer (Settings > Printer)
- [ ] Create user accounts for your staff (Admin > Users)

---

# 3. Dashboard Overview

After logging in, you'll see the **Dashboard** - your command center.

## 3.1 Dashboard Layout

```
┌──────────────────────────────────────────────────────┐
│  Dashboard                            [≡] Menu       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Today's Sales│  │ Transactions │                 │
│  │  ₱12,500.00  │  │      15      │                 │
│  └──────────────┘  └──────────────┘                 │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Avg. Trans.  │  │  Cash Sales  │                 │
│  │   ₱833.33    │  │  ₱10,200.00  │                 │
│  └──────────────┘  └──────────────┘                 │
│                                                      │
│  ─────────── Quick Actions ───────────              │
│                                                      │
│  [New Sale]  [Reports]  [Inventory]  [Settings]     │
│                                                      │
│  ─────────── Recent Transactions ───────────        │
│  • INV-00015  ₱850.00   Cash    10:45 AM           │
│  • INV-00014  ₱1,200.00 GCash   10:32 AM           │
│  • INV-00013  ₱650.00   Cash    10:15 AM           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 3.2 Dashboard Cards Explained

| Card | Description |
|------|-------------|
| **Today's Sales** | Total sales amount for the current day |
| **Transactions** | Number of completed transactions today |
| **Average Transaction** | Average value per transaction |
| **Cash Sales** | Total cash payments received |

## 3.3 Quick Action Buttons

- **New Sale**: Go directly to the POS terminal to start a sale
- **Reports**: Access all sales and inventory reports
- **Inventory**: View and manage product stock levels
- **Settings**: Access system configuration
- **Customers**: Manage customer records
- **Users**: Manage staff accounts (Admin only)

---

# 4. Making Sales (POS Terminal)

This is the most important section - how to process customer transactions.

## 4.1 Starting a Sale

1. Tap **"New Sale"** from Dashboard or navigate to **Sales** menu
2. The POS terminal will open

```
┌──────────────────────────────────────────────────────┐
│  Sales Terminal                         [≡] Menu     │
├──────────────────────────────────────────────────────┤
│  Search: [                    ] [🔍]  [📷 Scan]     │
│                                                      │
│  [Retail ●] [Wholesale ○]    ← Price Type Toggle    │
│                                                      │
│  Categories: [All] [Food] [Drinks] [Snacks] ...     │
├──────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Coca Cola  │ │   Rice      │ │ Cooking Oil │   │
│  │   ₱25.00    │ │  ₱55.00/kg  │ │   ₱85.00    │   │
│  │  Stock: 50  │ │  Stock: 100 │ │  Stock: 30  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                      │
├────────────────── CART ─────────────────────────────┤
│  1. Coca Cola (2)         ₱25.00 x 2    ₱50.00     │
│  2. Rice (1.5kg)          ₱55.00 x 1.5  ₱82.50     │
│                                                      │
│  Subtotal:                              ₱132.50     │
│  VAT (12%):                              ₱14.20     │
│  ────────────────────────────────────────────       │
│  TOTAL:                                ₱132.50     │
│                                                      │
│  [Discount] [👴 SC/PWD]          [CHECKOUT →]       │
└──────────────────────────────────────────────────────┘
```

## 4.2 Adding Products to Cart

### Method 1: Tap on Product
1. Browse products by scrolling or filtering by category
2. Tap on the product you want to add
3. The product is added to the cart with quantity 1

### Method 2: Search by Name
1. Tap the search bar at the top
2. Type the product name (e.g., "Coca")
3. Select from the dropdown results

### Method 3: Barcode Scanner
1. Tap the **[📷 Scan]** button
2. Point your camera at the product barcode
3. The product is automatically added to cart

## 4.3 Adjusting Quantities

### Increase Quantity
- Tap on the item in the cart
- Use the **[+]** button to increase
- Or tap the quantity number and enter a new amount

### Decrease Quantity
- Tap the **[-]** button to decrease
- Quantity cannot go below 1

### Remove Item
- Tap the **[🗑️]** trash icon next to the item
- Or reduce quantity to 0

### For Weighted Items (kg, liters)
1. Tap the item in cart
2. Enter the exact weight/quantity (e.g., 1.5 for 1.5kg)
3. Press **Confirm**

## 4.4 Retail vs Wholesale Pricing

If a product has both retail and wholesale prices:

1. **Before adding** items, select the price type:
   - **[Retail ●]** - Regular customer price
   - **[Wholesale ○]** - Bulk/reseller price

2. Add products to cart
3. Items will use the selected price type
4. Cart shows **"WS"** badge for wholesale items

**Note**: You can mix retail and wholesale items in the same cart!

## 4.5 Applying Discounts

### Regular Discount
1. Tap **[Discount]** button
2. Choose discount type:
   - **Percentage**: Enter percentage (e.g., 10 for 10% off)
   - **Fixed Amount**: Enter peso amount (e.g., 50 for ₱50 off)
3. Tap **Apply**

### Senior Citizen / PWD Discount (20%)
1. Tap **[👴 SC/PWD]** button
2. Enter the number of:
   - **Senior Citizens** in the group
   - **PWD customers** in the group
   - **Total customers** dining together
3. The system automatically calculates:
   - 20% discount on the senior/PWD's share
   - VAT exemption for seniors/PWD
4. Tap **Apply**

**Example**: 4 people dining, 1 is Senior Citizen
- Total bill: ₱1,000
- Senior's share: ₱250 (1/4 of bill)
- Senior's discount: ₱50 (20% of ₱250)
- Senior's VAT exemption: ~₱26.79
- **Total savings: ₱76.79**

## 4.6 Processing Payment (Checkout)

1. Tap **[CHECKOUT →]** button
2. The payment modal appears:

```
┌─────────────────────────────────────┐
│         Payment                     │
├─────────────────────────────────────┤
│  Total Amount:         ₱132.50      │
│                                     │
│  Payment Method:                    │
│  [Cash ●] [Card] [GCash] [Check]   │
│  [Charge (Credit)]                  │
│                                     │
│  ─── For Cash Payment ───          │
│  Amount Tendered: [₱200.00    ]    │
│  Change:                   ₱67.50   │
│                                     │
│  ─── Quick Cash ───                │
│  [₱100] [₱200] [₱500] [₱1000]     │
│  [Exact]                            │
│                                     │
│  Customer (Optional):               │
│  [Select or Add Customer    ▼]     │
│                                     │
│  [Cancel]        [Complete Sale]    │
└─────────────────────────────────────┘
```

### Payment Methods

| Method | Description | When to Use |
|--------|-------------|-------------|
| **Cash** | Physical cash payment | Most common |
| **Card** | Credit/debit card | Card terminals |
| **GCash/Online** | Mobile payment apps | GCash, Maya, etc. |
| **Check** | Bank check payment | Business customers |
| **Charge** | Credit/Pay later | Regular customers with credit |

### Cash Payment Steps
1. Select **Cash** payment method
2. Enter the amount the customer gave you
3. Or tap a quick cash button (₱100, ₱200, ₱500, ₱1000)
4. The system calculates change automatically
5. Tap **[Complete Sale]**

### Charge (Credit) Payment Steps
1. Select **Charge** payment method
2. **IMPORTANT**: You must select a customer
3. The sale amount is added to customer's balance
4. Customer pays later via Customer Payments screen

## 4.7 After the Sale

After completing a sale:

1. **Receipt prints** automatically (if printer connected)
2. **Invoice number** is generated (e.g., INV-00016)
3. **Stock is deducted** from inventory automatically
4. **Transaction is recorded** in eJournal for BIR compliance

### Receipt Options
- **Print**: Print another copy
- **Email**: Send receipt to customer email
- **Share**: Share via SMS, Viber, etc.
- **New Sale**: Start a new transaction

## 4.8 Voiding a Sale

If a mistake was made:

1. Tap **[≡] Menu** in Sales screen
2. Select **"Void Transaction"**
3. Enter the Invoice Number to void
4. Select a reason:
   - Wrong entry
   - Customer cancelled
   - System error
   - Other (specify)
5. Tap **Void**

**Note**: Voided transactions are still recorded in eJournal for BIR audit trail.

## 4.9 Processing Returns/Refunds

For returned items:

1. Tap **[≡] Menu** → **"Sales Return"**
2. Enter the original Invoice Number
3. Select items being returned
4. Enter return reason
5. Choose refund method:
   - Cash refund
   - Store credit
   - Exchange
6. Process the return

---

# 5. Product Management

## 5.1 Viewing Products

1. Navigate to **Products** from the main menu
2. You'll see all your products in a grid/list view

```
┌──────────────────────────────────────────────────────┐
│  Products                            [+ Add Product]  │
├──────────────────────────────────────────────────────┤
│  Search: [                    ] [🔍]                 │
│  Category: [All Categories ▼]                        │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐ │
│  │ Coca Cola 1.5L                                  │ │
│  │ Code: COC001  |  Barcode: 4800123456789        │ │
│  │ Category: Beverages  |  Brand: Coca-Cola       │ │
│  │ Retail: ₱85.00  |  Wholesale: ₱75.00          │ │
│  │ Stock: 45 pcs  |  Reorder Level: 10           │ │
│  │ VAT: Vatable (12%)                             │ │
│  │                          [Edit] [Delete]       │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Rice Premium 25kg                               │ │
│  │ Code: RIC001  |  Barcode: 4800987654321        │ │
│  │ ...                                             │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## 5.2 Adding a New Product

1. Tap **[+ Add Product]** button
2. Fill in the product details:

```
┌─────────────────────────────────────┐
│  Add New Product                    │
├─────────────────────────────────────┤
│  Product Code*: [AUTO-GENERATED   ] │
│  Product Name*: [                 ] │
│  Barcode:       [                 ] [Scan]│
│                                     │
│  Category*:     [Select...       ▼] │
│  Brand:         [Select...       ▼] │
│  Unit*:         [Pieces          ▼] │
│  Size:          [Select...       ▼] │
│                                     │
│  ─── Pricing ───                   │
│  Cost Price:    [₱              ] │
│  Selling Price*:[₱              ] │
│  Wholesale Price:[₱             ] │
│                                     │
│  ─── Inventory ───                 │
│  Current Stock: [0               ] │
│  Reorder Level: [10              ] │
│                                     │
│  ─── Tax Settings ───              │
│  VAT Type: [Vatable (12%)       ▼] │
│    ○ Vatable (12% VAT)             │
│    ○ VAT Exempt                    │
│    ○ Zero-Rated                    │
│                                     │
│  [Cancel]              [Save Product]│
└─────────────────────────────────────┘
```

### Required Fields (*)
- **Product Code**: Unique identifier (auto-generated if blank)
- **Product Name**: What appears on receipts
- **Category**: For organizing products
- **Unit**: Pieces, kilos, liters, etc.
- **Selling Price**: Retail price

### Optional but Recommended
- **Barcode**: For barcode scanning
- **Cost Price**: For profit margin tracking
- **Wholesale Price**: For bulk buyers
- **Reorder Level**: Low stock warning threshold

## 5.3 Editing a Product

1. Find the product in the list
2. Tap **[Edit]** button
3. Make your changes
4. Tap **[Save]**

## 5.4 Managing Categories

Categories help organize your products.

1. Go to **Master Data** → **Categories**
2. Tap **[+ Add Category]**
3. Enter category name (e.g., "Beverages", "Canned Goods", "Personal Care")
4. Tap **Save**

### Default Categories
- Food Items
- Beverages
- Snacks
- Personal Care
- Household
- Others

## 5.5 Managing Brands, Units, Sizes

Similar to categories:

1. Go to **Master Data**
2. Select **Brands**, **Units**, or **Sizes**
3. Add, edit, or delete as needed

**Common Units**:
- pcs (pieces)
- kg (kilograms)
- g (grams)
- L (liters)
- mL (milliliters)
- pack
- box
- dozen

---

# 6. Inventory Management

## 6.1 Viewing Current Stock

1. Go to **Inventory** → **Current Stock**
2. See all products with their quantities

```
┌──────────────────────────────────────────────────────┐
│  Current Stock Levels                                │
├──────────────────────────────────────────────────────┤
│  Product              Stock    Reorder   Status      │
├──────────────────────────────────────────────────────┤
│  Coca Cola 1.5L       45 pcs   10        ✓ OK       │
│  Rice Premium         8 kg     20        ⚠️ LOW      │
│  Cooking Oil          0 L      5         ❌ OUT      │
│  Sardines Can         125 pcs  30        ✓ OK       │
└──────────────────────────────────────────────────────┘
```

### Stock Status Indicators
- ✓ **OK** (Green): Stock above reorder level
- ⚠️ **LOW** (Yellow): Stock at or below reorder level
- ❌ **OUT** (Red): Zero stock

## 6.2 Inventory Movements

Track all stock changes:

1. Go to **Inventory** → **Inventory Movements**
2. See complete history of stock changes

| Movement Type | Description |
|---------------|-------------|
| **SALE** | Stock deducted from customer purchase |
| **PURCHASE** | Stock added from supplier delivery |
| **RETURN** | Stock returned (customer or supplier) |
| **ADJUSTMENT** | Manual stock correction |
| **DAMAGE** | Stock written off due to damage |
| **COUNT** | Adjustment from physical inventory |

## 6.3 Physical Inventory (Stock Count)

To count actual stock vs system records:

### Starting a Count
1. Go to **Inventory** → **Physical Inventory**
2. Tap **[Start New Count]**
3. Select which products to count:
   - All products
   - Specific category
   - Products with discrepancies

### Counting Products
```
┌─────────────────────────────────────┐
│  Physical Count: Session #5         │
│  Started: Jan 29, 2026 9:00 AM     │
├─────────────────────────────────────┤
│  Product: Coca Cola 1.5L            │
│  System Qty: 45 pcs                 │
│  Counted Qty: [    43    ]         │
│  Variance: -2 (Short)              │
│                                     │
│  [Previous] [Next] [Save Count]    │
└─────────────────────────────────────┘
```

1. Count each product physically
2. Enter the actual quantity
3. System shows variance
4. Tap **[Save Count]** to record

### Completing the Count
1. After counting all items, tap **[Finalize Count]**
2. Review variances
3. Approve adjustments
4. System updates stock quantities

## 6.4 Recording Damaged Items

When products are damaged:

1. Go to **Inventory** → **Damaged Items**
2. Tap **[+ Record Damage]**
3. Select the product
4. Enter quantity damaged
5. Select reason:
   - Expired
   - Broken/Defective
   - Water damage
   - Pest damage
   - Other
6. Tap **Save**

Stock is automatically deducted.

## 6.5 Inventory Reports

Available reports:

| Report | Description |
|--------|-------------|
| **Current Stock** | All products with quantities |
| **Low Stock Alert** | Products below reorder level |
| **Zero Inventory** | Out-of-stock products |
| **Stock Valuation** | Total inventory value (cost basis) |
| **Item Ledger** | Complete history for one product |
| **Inventory Movements** | All stock changes with audit trail |

---

# 7. Customer Management

## 7.1 Adding Customers

1. Go to **Customers** → **Customer Management**
2. Tap **[+ Add Customer]**

```
┌─────────────────────────────────────┐
│  Add Customer                       │
├─────────────────────────────────────┤
│  Customer Name*: [               ] │
│  Contact Number: [               ] │
│  Email:          [               ] │
│  Address:        [               ] │
│  TIN:            [               ] │
│                                     │
│  ─── Credit Settings ───           │
│  Credit Limit:   [₱ 5,000.00    ] │
│  Current Balance: ₱0.00            │
│                                     │
│  [Cancel]           [Save Customer] │
└─────────────────────────────────────┘
```

### Credit Limit
- Set how much a customer can owe (charge invoices)
- System warns when limit is reached
- Set to ₱0 to disable credit

## 7.2 Quick Add During Sale

While processing a sale:

1. In the payment modal, tap **[+ New Customer]**
2. Enter basic info (name, contact)
3. Save and continue with sale

## 7.3 Customer Payments

To record when a customer pays their balance:

1. Go to **Customers** → **Customer Payments**
2. Select the customer
3. Enter payment amount
4. Select payment method
5. Tap **Record Payment**

```
┌─────────────────────────────────────┐
│  Record Customer Payment            │
├─────────────────────────────────────┤
│  Customer: Juan dela Cruz           │
│  Outstanding Balance: ₱2,500.00     │
│                                     │
│  Payment Amount: [₱1,000.00     ] │
│  Payment Method: [Cash          ▼] │
│  Reference #:    [               ] │
│  Notes:          [               ] │
│                                     │
│  Balance After: ₱1,500.00          │
│                                     │
│  [Cancel]          [Record Payment] │
└─────────────────────────────────────┘
```

## 7.4 Customer Reports

### Accounts Receivable Report
Shows all customers with outstanding balances:
- Customer name
- Total credit sales
- Total payments
- Outstanding balance
- Aging (current, 30, 60, 90+ days)

### Customer Transaction History
1. Select a customer
2. View all transactions:
   - Sales (charge invoices)
   - Payments received
   - Returns/refunds

---

# 8. Supplier & Purchase Management

## 8.1 Adding Suppliers

1. Go to **Suppliers** → **Supplier Management**
2. Tap **[+ Add Supplier]**
3. Enter supplier details:
   - Business Name
   - Contact Person
   - Phone/Email
   - Address
   - TIN (Tax ID)
   - Payment Terms

## 8.2 Creating a Purchase Order

When you receive stock from suppliers:

1. Go to **Purchases** → **New Purchase**
2. Select the supplier
3. Add products and quantities:

```
┌──────────────────────────────────────────────────────┐
│  New Purchase Order          Supplier: ABC Trading   │
├──────────────────────────────────────────────────────┤
│  Add Product: [                    ] [🔍]            │
├──────────────────────────────────────────────────────┤
│  Product          Qty    Cost/Unit    Total          │
│  ──────────────────────────────────────────────      │
│  Coca Cola 1.5L   24     ₱70.00       ₱1,680.00     │
│  Rice Premium     50kg   ₱48.00/kg    ₱2,400.00     │
│  Cooking Oil      20L    ₱78.00/L     ₱1,560.00     │
│                                                      │
│                          Subtotal:    ₱5,640.00     │
│                          VAT (12%):     ₱676.80     │
│                          TOTAL:       ₱6,316.80     │
│                                                      │
│  Payment Terms: [30 Days Credit    ▼]               │
│                                                      │
│  [Cancel]  [Save Draft]  [Receive & Save]           │
└──────────────────────────────────────────────────────┘
```

4. Tap **[Receive & Save]** when goods are delivered
5. Stock quantities are automatically updated

## 8.3 Supplier Payments

To record payments to suppliers:

1. Go to **Suppliers** → **Supplier Payments**
2. Select the supplier
3. Enter payment details
4. Tap **Record Payment**

## 8.4 Purchase Returns

If you need to return items to supplier:

1. Go to **Purchases** → **Purchase Returns**
2. Select the original purchase order
3. Select items to return
4. Enter return reason
5. Process return

Stock is adjusted and supplier balance updated.

---

# 9. Reports & BIR Compliance

## 9.1 Understanding BIR Requirements

As a Philippine business, you must comply with BIR regulations:

- **Invoice Numbering**: Sequential, continuous numbers
- **VAT Handling**: Proper 12% VAT calculations
- **Z-Reading**: Daily end-of-day reports (REQUIRED)
- **X-Reading**: Mid-day inquiry reports
- **eJournal**: Complete audit trail of all transactions

## 9.2 Z-Reading (End of Day Report)

**IMPORTANT**: You MUST do Z-Reading at the end of each business day!

### What is Z-Reading?
- Official daily sales summary
- Cumulative totals for the day
- Resets counters for next day
- Required by BIR for audit

### How to Generate Z-Reading

1. Go to **Reports** → **Z-Reading** (or End of Day)
2. Review the summary:

```
┌──────────────────────────────────────────────────────┐
│  Z-READING REPORT                                    │
│  Date: January 29, 2026                             │
│  Machine Serial: POS-001                            │
├──────────────────────────────────────────────────────┤
│  Z-Counter:             000125                       │
│  Beginning SI:          INV-000451                   │
│  Ending SI:            INV-000478                   │
│                                                      │
│  ─── SALES SUMMARY ───                              │
│  Gross Sales:                        ₱45,678.50     │
│  Less: Returns                        (₱1,250.00)   │
│  Less: Discounts                      (₱2,345.00)   │
│  Less: Voids                            (₱500.00)   │
│                                      ───────────     │
│  Net Sales:                          ₱41,583.50     │
│                                                      │
│  ─── VAT BREAKDOWN ───                              │
│  VATable Sales:                      ₱37,128.13     │
│  VAT Amount (12%):                    ₱4,455.37     │
│  VAT-Exempt Sales:                    ₱4,000.00     │
│  Zero-Rated Sales:                        ₱0.00     │
│                                                      │
│  ─── TRANSACTION COUNT ───                          │
│  Cash Transactions:           15    ₱25,500.00     │
│  Card Transactions:            3     ₱8,000.00     │
│  GCash Transactions:           8     ₱6,083.50     │
│  Charge Transactions:          2     ₱2,000.00     │
│  ─────────────────────────────────────────          │
│  Total Transactions:          28    ₱41,583.50     │
│                                                      │
│  Voided Transactions:          2       ₱500.00     │
│  Return Transactions:          1     ₱1,250.00     │
│                                                      │
│  [Print Report]    [Close Day & Generate Z-Reading] │
└──────────────────────────────────────────────────────┘
```

3. Tap **[Close Day & Generate Z-Reading]**
4. Print and keep for records

### When to Do Z-Reading
- At the end of each business day
- Before turning off the POS
- System will warn you if you try to make sales with unclosed previous days

## 9.3 X-Reading (Inquiry Report)

### What is X-Reading?
- Mid-day sales inquiry
- Does NOT reset counters
- Can be done multiple times
- For checking current status

### How to Generate X-Reading

1. Go to **Reports** → **X-Reading**
2. View current day's running totals
3. Print if needed
4. Continue with normal sales

## 9.4 Sales Reports

### Daily Sales Report
1. Go to **Reports Hub** → **Sales Report**
2. Select date range
3. View detailed breakdown:
   - Per-transaction listing
   - Payment method summary
   - Product summary (top sellers)
   - Cashier summary

### Sales Returns Report
- All customer returns and refunds
- Reasons for returns
- Impact on sales totals

## 9.5 eJournal (Audit Trail)

The eJournal automatically records:
- All sales transactions
- Voids and reasons
- Returns and refunds
- Z-Reading generations
- System events

### Viewing eJournal
1. Go to **Reports** → **eJournal**
2. Select date range
3. View complete audit trail
4. Export for BIR submission if requested

## 9.6 Inventory Reports

| Report | Purpose |
|--------|---------|
| Current Stock | Snapshot of all inventory levels |
| Low Stock Alert | Products needing reorder |
| Zero Inventory | Out-of-stock items |
| Stock Valuation | Total inventory value |
| Item Ledger | History of one product |

## 9.7 Financial Reports

| Report | Purpose |
|--------|---------|
| Accounts Receivable | Customer balances owed |
| Accounts Payable | Amounts owed to suppliers |
| Purchase Report | All supplier purchases |

---

# 10. User Management & Permissions

## 10.1 Creating User Accounts

**Admin Only**

1. Go to **Admin** → **User Management**
2. Tap **[+ Add User]**

```
┌─────────────────────────────────────┐
│  Add New User                       │
├─────────────────────────────────────┤
│  Username*:    [                 ] │
│  Password*:    [                 ] │
│  Confirm:      [                 ] │
│  Full Name*:   [                 ] │
│                                     │
│  Role*:        [Cashier         ▼] │
│    ○ Admin                         │
│    ○ Manager                       │
│    ○ Cashier                       │
│                                     │
│  Status:       [Active          ▼] │
│                                     │
│  [Cancel]              [Save User] │
└─────────────────────────────────────┘
```

## 10.2 Understanding Roles

### Admin
- Full access to everything
- Can create/edit users
- Can change settings
- Can view all reports
- Can manage permissions

### Manager
- Business operations
- Sales and inventory
- Reports (as permitted)
- Cannot manage users
- Cannot change settings

### Cashier
- Sales transactions only
- View products
- Basic reports
- Limited access

## 10.3 Customizing Permissions

**Admin Only**

You can customize what Managers and Cashiers can access:

1. Go to **Admin** → **Permission Management**
2. Select role (Manager or Cashier)
3. Toggle permissions on/off:

```
┌──────────────────────────────────────────────────────┐
│  Permission Management: CASHIER Role                 │
├──────────────────────────────────────────────────────┤
│  Permission                              Status      │
│  ──────────────────────────────────────────────      │
│  ☑ VIEW_DASHBOARD         View main dashboard       │
│  ☑ CREATE_SALE            Process sales            │
│  ☐ VIEW_ALL_SALES         See all transactions     │
│  ☑ VIEW_OWN_SALES         See own transactions     │
│  ☐ VOID_SALE              Void transactions        │
│  ☐ REFUND_SALE            Process refunds          │
│  ☑ VIEW_PRODUCTS          See product catalog      │
│  ☐ MANAGE_PRODUCTS        Add/edit products        │
│  ☐ MANAGE_INVENTORY       Stock adjustments        │
│  ☐ VIEW_REPORTS           Access reports           │
│  ☐ PERFORM_Z_READING      Generate Z-Reading       │
│  ☑ PERFORM_X_READING      Generate X-Reading       │
│                                                      │
│  [Reset to Defaults]              [Save Permissions] │
└──────────────────────────────────────────────────────┘
```

### Permission Descriptions

| Permission | Description |
|------------|-------------|
| VIEW_DASHBOARD | Access the main dashboard |
| CREATE_SALE | Process sales transactions |
| VIEW_ALL_SALES | See all cashiers' transactions |
| VIEW_OWN_SALES | See only own transactions |
| VOID_SALE | Cancel/void transactions |
| REFUND_SALE | Process customer refunds |
| VIEW_PRODUCTS | See product catalog |
| MANAGE_PRODUCTS | Add, edit, delete products |
| MANAGE_INVENTORY | Stock counts, adjustments |
| VIEW_REPORTS | Access report screens |
| MANAGE_USERS | Create/edit user accounts |
| VIEW_SETTINGS | See settings screens |
| MANAGE_SETTINGS | Change system settings |
| PERFORM_Z_READING | Generate Z-Reading (day close) |
| PERFORM_X_READING | Generate X-Reading (inquiry) |
| MANAGE_PURCHASES | Create purchase orders |
| VIEW_EJOURNAL | Access audit trail |

## 10.4 Deactivating Users

Instead of deleting, deactivate users:

1. Go to **User Management**
2. Find the user
3. Tap **[Edit]**
4. Set Status to **Inactive**
5. Save

User can no longer log in but records are preserved.

---

# 11. Settings & Configuration

## 11.1 Business Information

1. Go to **Settings** → **Business Info**
2. Enter your business details:

```
┌─────────────────────────────────────┐
│  Business Information               │
├─────────────────────────────────────┤
│  Business Name:                     │
│  [IgoroTech Trading               ]│
│                                     │
│  Address Line 1:                    │
│  [123 Sample Street               ]│
│                                     │
│  Address Line 2:                    │
│  [Brgy. Sample, Sample City       ]│
│                                     │
│  Contact Number:                    │
│  [09123456789                     ]│
│                                     │
│  Email:                             │
│  [info@igorotech.com              ]│
│                                     │
│  [Cancel]              [Save Info]  │
└─────────────────────────────────────┘
```

This information appears on:
- Receipts
- Reports
- Z-Reading printouts

## 11.2 BIR Settings

**IMPORTANT**: Enter these correctly for BIR compliance!

1. Go to **Settings** → **BIR Settings**
2. Enter your BIR registration details:

```
┌─────────────────────────────────────┐
│  BIR Registration Details           │
├─────────────────────────────────────┤
│  Tax Identification Number (TIN):   │
│  [123-456-789-000                 ]│
│                                     │
│  BIR Permit Number:                 │
│  [0000-0000-0000-0000             ]│
│                                     │
│  Accreditation Number:              │
│  [000-000000000-00000             ]│
│                                     │
│  Date Issued:                       │
│  [01/15/2024                      ]│
│                                     │
│  Valid Until:                       │
│  [01/14/2029                      ]│
│                                     │
│  POS Machine Serial Number:         │
│  [POS-001                         ]│
│                                     │
│  MIN (Machine ID Number):           │
│  [00000000000000                  ]│
│                                     │
│  [Cancel]              [Save BIR]   │
└─────────────────────────────────────┘
```

## 11.3 VAT Settings

1. Go to **Settings** → **Tax Settings**
2. Configure VAT:
   - Default VAT Rate: 12%
   - Default product VAT type: Vatable/Exempt/Zero-rated

## 11.4 Receipt Settings

Customize what appears on receipts:

- Header text (business name, address)
- Footer text (thank you message, return policy)
- Show/hide certain fields
- Logo (if printer supports)

---

# 12. Bluetooth Printing

## 12.1 Supported Printers

The system works with standard ESC/POS thermal printers:
- 58mm paper width (32 characters per line)
- 80mm paper width (48 characters per line)

Popular brands: Epson, Xprinter, GOOJPRT, PeriPage, etc.

## 12.2 Pairing Your Printer

**First, pair via Android Settings:**

1. Turn on your printer
2. Open Android **Settings** → **Bluetooth**
3. Scan for devices
4. Select your printer (usually named "Printer" or the model number)
5. Pair the device

## 12.3 Connecting in the App

1. Go to **Settings** → **Printer Settings**
2. Tap **[Scan for Printers]**
3. Select your printer from the list
4. Select paper width (58mm or 80mm)
5. Tap **[Test Print]** to verify

```
┌─────────────────────────────────────┐
│  Printer Settings                   │
├─────────────────────────────────────┤
│  Connected Printer:                 │
│  ✓ Xprinter XP-58II                │
│                                     │
│  Paper Width: [80mm             ▼] │
│    ○ 58mm (32 characters)          │
│    ● 80mm (48 characters)          │
│                                     │
│  Print Quality: [Normal         ▼] │
│                                     │
│  Auto-Print Receipt: [ON        ▼] │
│                                     │
│  [Scan for Printers]  [Test Print] │
└─────────────────────────────────────┘
```

## 12.4 Troubleshooting Printing

| Problem | Solution |
|---------|----------|
| Printer not found | Ensure printer is on and paired in Android Bluetooth settings |
| Garbled text | Check paper width setting matches your printer |
| Not printing | Turn printer off/on, try reconnecting |
| Paper jam | Open printer, remove jammed paper, reload |
| Faint print | Replace thermal paper roll |

---

# 13. Backup & Data Management

## 13.1 Database Backup

**IMPORTANT**: Regularly back up your data!

### Creating a Backup

1. Go to **Settings** → **Backup & Restore**
2. Tap **[Create Backup]**
3. Backup file is created with timestamp
4. Share/save to cloud storage or another device

```
┌─────────────────────────────────────┐
│  Backup & Restore                   │
├─────────────────────────────────────┤
│  Last Backup: Jan 28, 2026 6:00 PM │
│                                     │
│  [Create Backup]                    │
│                                     │
│  ─── Available Backups ───         │
│  • backup_2026-01-28_18-00.db      │
│  • backup_2026-01-27_18-00.db      │
│  • backup_2026-01-26_18-00.db      │
│                                     │
│  [Restore from Backup]              │
│  [Export Backup to Storage]         │
└─────────────────────────────────────┘
```

### Recommended Backup Schedule
- **Daily**: End of day (after Z-Reading)
- **Weekly**: To cloud storage (Google Drive, etc.)
- **Monthly**: To external storage or computer

## 13.2 Restoring from Backup

**WARNING**: This replaces all current data!

1. Go to **Settings** → **Backup & Restore**
2. Tap **[Restore from Backup]**
3. Select the backup file
4. Confirm restoration
5. App restarts with restored data

## 13.3 Data Reset

To clear transaction data (start fresh):

1. Go to **Settings** → **Reset Data**
2. Choose what to reset:
   - **Transactions Only**: Clears sales, keeps products
   - **Full Reset**: Clears everything (careful!)
3. Enter admin password to confirm
4. Data is cleared

**Note**: This is irreversible! Always backup first.

---

# 14. Troubleshooting

## 14.1 Common Issues

### "Unterminated Session" Warning

**Problem**: System blocks new sales, shows warning about previous days.

**Solution**:
1. You have sales from previous days without Z-Reading
2. Go to **End of Day** screen
3. Complete Z-Reading for each pending day
4. Then you can make new sales

### Login Failed

**Problem**: Cannot log in.

**Solutions**:
- Check username/password (case-sensitive)
- Ensure account is Active (not deactivated)
- Try default admin: username "admin"

### Products Not Showing

**Problem**: Products missing from POS.

**Solutions**:
- Check if product is marked Active
- Check stock quantity (zero stock might be hidden)
- Clear category filter (select "All")

### Printer Not Working

**Problem**: Receipt won't print.

**Solutions**:
1. Check printer power and paper
2. Check Bluetooth connection in Android settings
3. Go to Printer Settings, reconnect
4. Try Test Print
5. Restart printer and app

### Wrong Calculations

**Problem**: Total seems incorrect.

**Check**:
- VAT settings (12% VAT-inclusive vs exclusive)
- Discount applied correctly
- Senior/PWD calculations (see Section 4.5)

### App Crashes

**Solutions**:
1. Close and reopen the app
2. Clear app cache (Android Settings → Apps → POS → Clear Cache)
3. Restart your device
4. If persists, restore from backup

## 14.2 Getting Help

If you encounter issues not covered here:

1. Document the problem (screenshots help)
2. Note exact error messages
3. Contact support with details

---

# 15. Quick Reference Card

## Daily Checklist

### Start of Day
- [ ] Log in with your account
- [ ] Check if system asks for unterminated sessions
- [ ] Complete any pending Z-Readings
- [ ] Start shift (if prompted)
- [ ] Test printer connection

### During Operations
- [ ] Process sales as customers come
- [ ] Apply discounts as needed (SC/PWD, promo)
- [ ] Handle returns/refunds properly
- [ ] Record customer payments

### End of Day
- [ ] Do Cash Count (count physical cash)
- [ ] Generate X-Reading (optional, for review)
- [ ] Generate Z-Reading (REQUIRED)
- [ ] Print and file Z-Reading report
- [ ] Create backup
- [ ] Turn off printer

## Keyboard Shortcuts (Physical Keyboard)

| Shortcut | Action |
|----------|--------|
| Enter | Confirm/Submit |
| Esc | Cancel/Back |
| F1 | Help |
| F5 | Refresh |

## Key Contact Information

- **BIR Hotline**: 8538-3200
- **BIR Email**: contact_us@bir.gov.ph

## Important BIR Deadlines

- **Z-Reading**: Must be done daily
- **eJournal Retention**: Keep for 10 years
- **BIR Permit Renewal**: Every 5 years

---

## Receipt Sample

```
================================
      IGOROTECH TRADING
   123 Sample Street, Brgy.
     Sample, Sample City
     TIN: 123-456-789-000
================================
Date: Jan 29, 2026  10:45 AM
Cashier: Juan dela Cruz
Invoice #: INV-000125
--------------------------------
QTY  DESCRIPTION         AMOUNT
--------------------------------
2    Coca Cola 1.5L      ₱170.00
1.5  Rice Premium (kg)   ₱82.50
1    Cooking Oil 1L      ₱85.00
--------------------------------
     Subtotal:          ₱337.50
     VAT (12%):          ₱36.16
     ────────────────────────
     TOTAL:             ₱337.50
--------------------------------
     Cash Tendered:     ₱500.00
     Change:            ₱162.50
================================
THIS SERVES AS YOUR OFFICIAL
INVOICE
BIR Permit: 0000-0000-0000-0000
Accred #: 000-000000000-00000
================================
    Thank you for shopping!
      Please come again.
================================
```

---

## Document Information

**Manual Version**: 1.0
**Last Updated**: January 29, 2026
**Applicable Software Version**: IgoroTech Mobile POS v1.0

**BIR Compliance**:
- Revenue Regulations No. 7-2024 (Invoice Transition)
- Revenue Regulations No. 11-2024 (Extended Deadlines)

---

*This manual is provided for informational purposes. For official BIR requirements, consult directly with the Bureau of Internal Revenue.*

---

# END OF USER MANUAL
