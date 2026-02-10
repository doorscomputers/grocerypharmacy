/**
 * Real SQL Query E2E Tests
 *
 * This test file uses better-sqlite3 to test the EXACT SQL queries
 * from DatabaseService.ts. This ensures that the queries work correctly
 * with real SQLite, not just JavaScript array operations.
 *
 * Key SQL queries tested:
 * - X-Reading sales summary (DatabaseService.ts line 7017-7032)
 * - Z-Reading sales summary (DatabaseService.ts line 851-862)
 * - Customer payments summary (DatabaseService.ts line 7104-7114)
 * - Cash movements summary (DatabaseService.ts line 6405-6414)
 */

import Database from 'better-sqlite3';

// ============================================================================
// SCHEMA - Exact copy from database/schema.ts
// ============================================================================

const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT NOT NULL UNIQUE,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    customer_name TEXT,
    customer_tin TEXT,
    customer_address TEXT,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('CASH', 'CARD', 'CHECK', 'ONLINE', 'CHARGE_INVOICE')) DEFAULT 'CASH',
    amount_tendered DECIMAL(10,2) NOT NULL,
    change_amount DECIMAL(10,2) DEFAULT 0,
    payment_status TEXT CHECK (payment_status IN ('PAID', 'UNPAID', 'PARTIAL')) DEFAULT 'PAID',
    cashier_id INTEGER NOT NULL,
    status TEXT CHECK (status IN ('COMPLETED', 'VOID', 'REFUNDED')) DEFAULT 'COMPLETED',
    void_reason TEXT,
    void_by INTEGER,
    void_date DATETIME,
    sc_pwd_id TEXT,
    sc_pwd_name TEXT,
    sc_pwd_type TEXT CHECK (sc_pwd_type IN ('SENIOR', 'PWD')),
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_TRANSACTION_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    price_type TEXT DEFAULT 'retail',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_CUSTOMER_PAYMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    transaction_id INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('CASH', 'CARD', 'CHECK', 'BANK_TRANSFER', 'ONLINE', 'GCASH')) NOT NULL,
    amount_paid DECIMAL(12,2) NOT NULL,
    reference_number TEXT,
    notes TEXT,
    received_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_CASH_MOVEMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_type TEXT CHECK (movement_type IN ('OPENING_FUND', 'CASH_IN', 'CASH_OUT', 'PETTY_CASH', 'CASH_REFUND')) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    reference_number TEXT,
    approved_by TEXT,
    cashier_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_SALES_RETURNS_TABLE = `
  CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT NOT NULL UNIQUE,
    original_transaction_id INTEGER,
    original_invoice_number TEXT,
    customer_id INTEGER,
    customer_name TEXT,
    return_date DATE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    refund_method TEXT CHECK (refund_method IN ('CASH', 'CREDIT', 'STORE_CREDIT', 'EXCHANGE')) DEFAULT 'CASH',
    reason TEXT NOT NULL,
    notes TEXT,
    processed_by INTEGER NOT NULL,
    status TEXT CHECK (status IN ('COMPLETED', 'CANCELLED')) DEFAULT 'COMPLETED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_PRODUCTS_TABLE = `
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) DEFAULT 0,
    vat_type TEXT CHECK (vat_type IN ('vatable', 'vat_exempt', 'zero_rated')) DEFAULT 'vatable',
    tax_rate DECIMAL(5,2) DEFAULT 12,
    is_vat_inclusive BOOLEAN DEFAULT 1,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// ============================================================================
// SQL QUERIES - Exact copy from DatabaseService.ts
// ============================================================================

// X-Reading sales summary query (from DatabaseService.ts line 7017-7032)
const X_READING_SALES_QUERY = `
  SELECT
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as transaction_count,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN (COALESCE(total_amount, 0) + COALESCE(discount_amount, 0)) ELSE 0 END), 0) as gross_sales,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN tax_amount ELSE 0 END), 0) as vat_amount,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN discount_amount ELSE 0 END), 0) as discount_amount,
    COALESCE(SUM(CASE WHEN status = 'VOID' THEN total_amount ELSE 0 END), 0) as void_amount,
    COUNT(CASE WHEN status = 'VOID' THEN 1 END) as void_count,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND payment_method = 'CARD' THEN total_amount ELSE 0 END), 0) as card_sales,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND payment_method = 'CHECK' THEN total_amount ELSE 0 END), 0) as check_sales,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND (payment_method = 'CHARGE_INVOICE' OR payment_method = 'CREDIT') THEN total_amount ELSE 0 END), 0) as credit_sales,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND payment_method = 'ONLINE' THEN total_amount ELSE 0 END), 0) as online_sales
  FROM transactions
  WHERE DATE(transaction_date) = ?
`;

// Z-Reading sales summary query (from DatabaseService.ts line 851-862)
const Z_READING_SALES_QUERY = `
  SELECT
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as gross_sales,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN tax_amount ELSE 0 END), 0) as vat_amount,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN discount_amount ELSE 0 END), 0) as discount_amount,
    COALESCE(SUM(CASE WHEN status = 'VOID' THEN total_amount ELSE 0 END), 0) as void_amount,
    COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount - discount_amount ELSE 0 END), 0) as net_sales,
    MIN(invoice_number) as start_invoice,
    MAX(invoice_number) as end_invoice
  FROM transactions
  WHERE DATE(transaction_date) = ? AND cashier_id = ?
`;

// Customer payments summary query (from DatabaseService.ts line 7104-7114)
const CUSTOMER_PAYMENTS_QUERY = `
  SELECT
    COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount_paid ELSE 0 END), 0) as cash_payments,
    COALESCE(SUM(CASE WHEN payment_method = 'CHECK' THEN amount_paid ELSE 0 END), 0) as check_payments,
    COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN amount_paid ELSE 0 END), 0) as card_payments,
    COALESCE(SUM(CASE WHEN payment_method = 'ONLINE' OR payment_method = 'GCASH' THEN amount_paid ELSE 0 END), 0) as online_payments,
    COALESCE(SUM(CASE WHEN payment_method = 'BANK_TRANSFER' THEN amount_paid ELSE 0 END), 0) as bank_transfer_payments,
    COALESCE(SUM(amount_paid), 0) as total_payments
  FROM customer_payments
  WHERE DATE(payment_date) = ?
`;

// Cash movements summary query (from DatabaseService.ts line 6405-6414)
const CASH_MOVEMENTS_QUERY = `
  SELECT
    COALESCE(SUM(CASE WHEN movement_type = 'OPENING_FUND' THEN amount ELSE 0 END), 0) as opening_fund,
    COALESCE(SUM(CASE WHEN movement_type = 'CASH_IN' THEN amount ELSE 0 END), 0) as cash_in,
    COALESCE(SUM(CASE WHEN movement_type = 'CASH_OUT' THEN amount ELSE 0 END), 0) as cash_out,
    COALESCE(SUM(CASE WHEN movement_type = 'PETTY_CASH' THEN amount ELSE 0 END), 0) as petty_cash,
    COALESCE(SUM(CASE WHEN movement_type = 'CASH_REFUND' THEN amount ELSE 0 END), 0) as cash_refunds
  FROM cash_movements
  WHERE DATE(created_at) = ?
`;

// Refunds query (from DatabaseService.ts line 7064-7070)
const REFUNDS_QUERY = `
  SELECT
    COALESCE(SUM(total_amount), 0) as refund_amount,
    COUNT(*) as refund_count
  FROM sales_returns
  WHERE DATE(return_date) = ? AND status = 'COMPLETED' AND refund_method != 'EXCHANGE'
`;

// Exchanges query (from DatabaseService.ts line 7073-7079)
const EXCHANGES_QUERY = `
  SELECT
    COALESCE(SUM(total_amount), 0) as exchange_amount,
    COUNT(*) as exchange_count
  FROM sales_returns
  WHERE DATE(return_date) = ? AND status = 'COMPLETED' AND refund_method = 'EXCHANGE'
`;

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Real SQL Query E2E Tests', () => {
  let db: Database.Database;
  const testDate = '2026-02-10';
  const cashierId = 1;

  beforeEach(() => {
    // Create in-memory database for each test
    db = new Database(':memory:');

    // Create tables
    db.exec(CREATE_TRANSACTIONS_TABLE);
    db.exec(CREATE_TRANSACTION_ITEMS_TABLE);
    db.exec(CREATE_CUSTOMER_PAYMENTS_TABLE);
    db.exec(CREATE_CASH_MOVEMENTS_TABLE);
    db.exec(CREATE_SALES_RETURNS_TABLE);
    db.exec(CREATE_PRODUCTS_TABLE);
  });

  afterEach(() => {
    db.close();
  });

  // Helper to insert a transaction
  function insertTransaction(data: {
    invoiceNumber: string;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    transactionDate?: string;
  }) {
    const stmt = db.prepare(`
      INSERT INTO transactions (
        transaction_number, invoice_number, subtotal, tax_amount, discount_amount,
        total_amount, payment_method, amount_tendered, change_amount,
        payment_status, cashier_id, status, transaction_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const txnNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const txnDate = data.transactionDate || `${testDate} 10:00:00`;

    stmt.run(
      txnNumber,
      data.invoiceNumber,
      data.subtotal,
      data.taxAmount,
      data.discountAmount,
      data.totalAmount,
      data.paymentMethod,
      data.totalAmount, // amount_tendered
      0, // change_amount
      'PAID',
      cashierId,
      data.status,
      txnDate,
      txnDate
    );

    return db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  }

  // Helper to insert customer payment
  function insertCustomerPayment(data: {
    paymentMethod: string;
    amountPaid: number;
    paymentDate?: string;
  }) {
    const stmt = db.prepare(`
      INSERT INTO customer_payments (
        payment_number, transaction_id, payment_date, payment_method,
        amount_paid, received_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const paymentDate = data.paymentDate || testDate;

    stmt.run(
      paymentNumber,
      1, // transaction_id
      paymentDate,
      data.paymentMethod,
      data.amountPaid,
      cashierId,
      `${paymentDate} 10:00:00`
    );
  }

  // Helper to insert cash movement
  function insertCashMovement(data: {
    movementType: string;
    amount: number;
    createdAt?: string;
  }) {
    const stmt = db.prepare(`
      INSERT INTO cash_movements (
        movement_type, amount, description, cashier_id, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const createdAt = data.createdAt || `${testDate} 10:00:00`;

    stmt.run(
      data.movementType,
      data.amount,
      `${data.movementType} - Test`,
      cashierId,
      createdAt
    );
  }

  // Helper to insert sales return
  function insertSalesReturn(data: {
    refundMethod: string;
    totalAmount: number;
    returnDate?: string;
  }) {
    const stmt = db.prepare(`
      INSERT INTO sales_returns (
        return_number, return_date, total_amount, refund_method,
        reason, processed_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const returnDate = data.returnDate || testDate;

    stmt.run(
      returnNumber,
      returnDate,
      data.totalAmount,
      data.refundMethod,
      'Test return',
      cashierId,
      'COMPLETED',
      `${returnDate} 10:00:00`
    );
  }

  // ========================================
  // X-READING SQL QUERY TESTS
  // ========================================

  describe('X-Reading SQL Queries', () => {
    test('calculates gross_sales correctly (total_amount + discount_amount)', () => {
      // Insert transactions with discounts
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100,
        taxAmount: 10.71,
        discountAmount: 10,
        totalAmount: 90, // 100 - 10 discount
        paymentMethod: 'CASH',
        status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 200,
        taxAmount: 21.43,
        discountAmount: 20,
        totalAmount: 180, // 200 - 20 discount
        paymentMethod: 'CASH',
        status: 'COMPLETED'
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      // Gross sales = (90 + 10) + (180 + 20) = 300
      expect(result.gross_sales).toBe(300);
      expect(result.discount_amount).toBe(30);
    });

    test('excludes VOID transactions from gross_sales', () => {
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100,
        taxAmount: 10.71,
        discountAmount: 0,
        totalAmount: 100,
        paymentMethod: 'CASH',
        status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 200,
        taxAmount: 21.43,
        discountAmount: 0,
        totalAmount: 200,
        paymentMethod: 'CASH',
        status: 'VOID'
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      // Only COMPLETED transaction should be in gross_sales
      expect(result.gross_sales).toBe(100);
      expect(result.void_amount).toBe(200);
      expect(result.void_count).toBe(1);
      expect(result.transaction_count).toBe(1);
    });

    test('breaks down sales by payment method correctly', () => {
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 0, totalAmount: 100,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 200, taxAmount: 21.43, discountAmount: 0, totalAmount: 200,
        paymentMethod: 'CARD', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-003',
        subtotal: 300, taxAmount: 32.14, discountAmount: 0, totalAmount: 300,
        paymentMethod: 'CHECK', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-004',
        subtotal: 400, taxAmount: 42.86, discountAmount: 0, totalAmount: 400,
        paymentMethod: 'CHARGE_INVOICE', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-005',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'ONLINE', status: 'COMPLETED'
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      expect(result.cash_sales).toBe(100);
      expect(result.card_sales).toBe(200);
      expect(result.check_sales).toBe(300);
      expect(result.credit_sales).toBe(400);
      expect(result.online_sales).toBe(500);
      expect(result.gross_sales).toBe(1500);
      expect(result.transaction_count).toBe(5);
    });

    test('handles transactions with zero amounts', () => {
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      expect(result.gross_sales).toBe(0);
      expect(result.transaction_count).toBe(1);
    });

    test('handles no transactions', () => {
      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      expect(result.gross_sales).toBe(0);
      expect(result.cash_sales).toBe(0);
      expect(result.transaction_count).toBe(0);
    });
  });

  // ========================================
  // Z-READING SQL QUERY TESTS
  // ========================================

  describe('Z-Reading SQL Queries', () => {
    test('calculates net_sales correctly (total_amount - discount_amount)', () => {
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 10, totalAmount: 90,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 200, taxAmount: 21.43, discountAmount: 20, totalAmount: 180,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      const result = db.prepare(Z_READING_SALES_QUERY).get(testDate, cashierId) as any;

      // Z-Reading gross_sales = SUM(total_amount) for COMPLETED = 90 + 180 = 270
      expect(result.gross_sales).toBe(270);
      // net_sales = total_amount - discount_amount = (90-10) + (180-20) = 80 + 160 = 240
      // Wait, the query is: total_amount - discount_amount
      // 90 - 10 = 80, 180 - 20 = 160, sum = 240
      expect(result.net_sales).toBe(240);
      expect(result.discount_amount).toBe(30);
    });

    test('gets correct invoice number range', () => {
      insertTransaction({
        invoiceNumber: 'INV-00000001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 0, totalAmount: 100,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-00000002',
        subtotal: 200, taxAmount: 21.43, discountAmount: 0, totalAmount: 200,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-00000003',
        subtotal: 300, taxAmount: 32.14, discountAmount: 0, totalAmount: 300,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      const result = db.prepare(Z_READING_SALES_QUERY).get(testDate, cashierId) as any;

      expect(result.start_invoice).toBe('INV-00000001');
      expect(result.end_invoice).toBe('INV-00000003');
    });

    test('filters by cashier_id', () => {
      const otherCashierId = 2;

      // Transaction for cashier 1
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 0, totalAmount: 100,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Transaction for cashier 2 - insert directly
      db.prepare(`
        INSERT INTO transactions (
          transaction_number, invoice_number, subtotal, tax_amount, discount_amount,
          total_amount, payment_method, amount_tendered, change_amount,
          payment_status, cashier_id, status, transaction_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'TXN-OTHER', 'INV-002', 200, 21.43, 0, 200, 'CASH', 200, 0,
        'PAID', otherCashierId, 'COMPLETED', `${testDate} 11:00:00`, `${testDate} 11:00:00`
      );

      const result1 = db.prepare(Z_READING_SALES_QUERY).get(testDate, cashierId) as any;
      const result2 = db.prepare(Z_READING_SALES_QUERY).get(testDate, otherCashierId) as any;

      expect(result1.gross_sales).toBe(100);
      expect(result2.gross_sales).toBe(200);
    });
  });

  // ========================================
  // CUSTOMER PAYMENTS SQL QUERY TESTS
  // ========================================

  describe('Customer Payments SQL Queries', () => {
    test('breaks down AR payments by method correctly', () => {
      insertCustomerPayment({ paymentMethod: 'CASH', amountPaid: 100 });
      insertCustomerPayment({ paymentMethod: 'CHECK', amountPaid: 200 });
      insertCustomerPayment({ paymentMethod: 'CARD', amountPaid: 300 });
      insertCustomerPayment({ paymentMethod: 'ONLINE', amountPaid: 400 });
      insertCustomerPayment({ paymentMethod: 'BANK_TRANSFER', amountPaid: 500 });

      const result = db.prepare(CUSTOMER_PAYMENTS_QUERY).get(testDate) as any;

      expect(result.cash_payments).toBe(100);
      expect(result.check_payments).toBe(200);
      expect(result.card_payments).toBe(300);
      expect(result.online_payments).toBe(400);
      expect(result.bank_transfer_payments).toBe(500);
      expect(result.total_payments).toBe(1500);
    });

    test('handles GCASH as online payment', () => {
      insertCustomerPayment({ paymentMethod: 'GCASH', amountPaid: 150 });
      insertCustomerPayment({ paymentMethod: 'ONLINE', amountPaid: 100 });

      const result = db.prepare(CUSTOMER_PAYMENTS_QUERY).get(testDate) as any;

      // GCASH and ONLINE should both be counted in online_payments
      expect(result.online_payments).toBe(250);
    });

    test('handles no payments', () => {
      const result = db.prepare(CUSTOMER_PAYMENTS_QUERY).get(testDate) as any;

      expect(result.total_payments).toBe(0);
      expect(result.cash_payments).toBe(0);
    });
  });

  // ========================================
  // CASH MOVEMENTS SQL QUERY TESTS
  // ========================================

  describe('Cash Movements SQL Queries', () => {
    test('calculates cash drawer balance correctly', () => {
      insertCashMovement({ movementType: 'OPENING_FUND', amount: 5000 });
      insertCashMovement({ movementType: 'CASH_IN', amount: 2000 });
      insertCashMovement({ movementType: 'CASH_OUT', amount: 500 });
      insertCashMovement({ movementType: 'PETTY_CASH', amount: 300 });
      insertCashMovement({ movementType: 'CASH_REFUND', amount: 100 });

      const result = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;

      expect(result.opening_fund).toBe(5000);
      expect(result.cash_in).toBe(2000);
      expect(result.cash_out).toBe(500);
      expect(result.petty_cash).toBe(300);
      expect(result.cash_refunds).toBe(100);

      // Net balance = 5000 + 2000 - 500 - 300 - 100 = 6100
      const netBalance = result.opening_fund + result.cash_in -
                         result.cash_out - result.petty_cash - result.cash_refunds;
      expect(netBalance).toBe(6100);
    });

    test('handles no cash movements', () => {
      const result = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;

      expect(result.opening_fund).toBe(0);
      expect(result.cash_in).toBe(0);
      expect(result.cash_out).toBe(0);
      expect(result.petty_cash).toBe(0);
      expect(result.cash_refunds).toBe(0);
    });
  });

  // ========================================
  // REFUNDS AND EXCHANGES SQL QUERY TESTS
  // ========================================

  describe('Refunds and Exchanges SQL Queries', () => {
    test('separates refunds from exchanges', () => {
      insertSalesReturn({ refundMethod: 'CASH', totalAmount: 100 });
      insertSalesReturn({ refundMethod: 'CREDIT', totalAmount: 150 });
      insertSalesReturn({ refundMethod: 'EXCHANGE', totalAmount: 200 });

      const refundResult = db.prepare(REFUNDS_QUERY).get(testDate) as any;
      const exchangeResult = db.prepare(EXCHANGES_QUERY).get(testDate) as any;

      // Refunds = CASH (100) + CREDIT (150) = 250
      expect(refundResult.refund_amount).toBe(250);
      expect(refundResult.refund_count).toBe(2);

      // Exchanges = 200
      expect(exchangeResult.exchange_amount).toBe(200);
      expect(exchangeResult.exchange_count).toBe(1);
    });

    test('handles no returns', () => {
      const refundResult = db.prepare(REFUNDS_QUERY).get(testDate) as any;
      const exchangeResult = db.prepare(EXCHANGES_QUERY).get(testDate) as any;

      expect(refundResult.refund_amount).toBe(0);
      expect(refundResult.refund_count).toBe(0);
      expect(exchangeResult.exchange_amount).toBe(0);
      expect(exchangeResult.exchange_count).toBe(0);
    });
  });

  // ========================================
  // EXPECTED CASH CALCULATION TEST
  // ========================================

  describe('Expected Cash Calculation', () => {
    test('calculates expected cash correctly', () => {
      // Beginning cash
      const beginningCash = 1000;

      // Cash movements
      insertCashMovement({ movementType: 'OPENING_FUND', amount: 5000 });
      insertCashMovement({ movementType: 'CASH_IN', amount: 2000 });
      insertCashMovement({ movementType: 'PETTY_CASH', amount: 500 });
      insertCashMovement({ movementType: 'CASH_REFUND', amount: 100 });

      // Cash sales
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 300, taxAmount: 32.14, discountAmount: 0, totalAmount: 300,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Non-cash sales (should not affect expected cash)
      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CARD', status: 'COMPLETED'
      });

      // AR cash payments
      insertCustomerPayment({ paymentMethod: 'CASH', amountPaid: 200 });
      insertCustomerPayment({ paymentMethod: 'CARD', amountPaid: 300 }); // Should not affect

      // Get all data
      const cashMovements = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;
      const salesData = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;
      const arPayments = db.prepare(CUSTOMER_PAYMENTS_QUERY).get(testDate) as any;

      // Calculate expected cash
      // Formula: Beginning Cash + Cash Fund Net + Cash Sales + AR Cash Payments
      // Cash Fund Net = opening_fund + cash_in - cash_out - petty_cash - cash_refunds
      const cashFundNet = cashMovements.opening_fund + cashMovements.cash_in -
                          cashMovements.cash_out - cashMovements.petty_cash - cashMovements.cash_refunds;
      // = 5000 + 2000 - 0 - 500 - 100 = 6400

      const expectedCash = beginningCash + cashFundNet + salesData.cash_sales + arPayments.cash_payments;
      // = 1000 + 6400 + 300 + 200 = 7900

      expect(cashFundNet).toBe(6400);
      expect(salesData.cash_sales).toBe(300);
      expect(arPayments.cash_payments).toBe(200);
      expect(expectedCash).toBe(7900);
    });
  });

  // ========================================
  // BIR COMPLIANCE TESTS
  // ========================================

  describe('BIR Compliance', () => {
    test('invoice numbers are sequential (MIN/MAX query works)', () => {
      // Insert invoices in non-sequential order
      insertTransaction({
        invoiceNumber: 'INV-00000003',
        subtotal: 300, taxAmount: 32.14, discountAmount: 0, totalAmount: 300,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-00000001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 0, totalAmount: 100,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      insertTransaction({
        invoiceNumber: 'INV-00000002',
        subtotal: 200, taxAmount: 21.43, discountAmount: 0, totalAmount: 200,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      const result = db.prepare(Z_READING_SALES_QUERY).get(testDate, cashierId) as any;

      // MIN should get lowest, MAX should get highest regardless of insert order
      expect(result.start_invoice).toBe('INV-00000001');
      expect(result.end_invoice).toBe('INV-00000003');
    });

    test('VAT amount is tracked correctly', () => {
      // Insert transactions with known VAT
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 112, // 100 + 12% VAT
        taxAmount: 12,
        discountAmount: 0,
        totalAmount: 112,
        paymentMethod: 'CASH',
        status: 'COMPLETED'
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      expect(result.vat_amount).toBe(12);
    });

    test('SC/PWD transactions are tracked', () => {
      // Insert SC transaction
      db.prepare(`
        INSERT INTO transactions (
          transaction_number, invoice_number, subtotal, tax_amount, discount_amount,
          total_amount, payment_method, amount_tendered, change_amount,
          payment_status, cashier_id, status, sc_pwd_id, sc_pwd_name, sc_pwd_type,
          transaction_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'TXN-SC', 'INV-SC-001', 66.96, 0, 13.39, 53.57,
        'CASH', 60, 6.43, 'PAID', cashierId, 'COMPLETED',
        'SC-123456', 'Maria Santos', 'SENIOR',
        `${testDate} 10:00:00`, `${testDate} 10:00:00`
      );

      // Query to verify SC transaction is recorded
      const scQuery = `
        SELECT COUNT(*) as count, SUM(discount_amount) as sc_discount
        FROM transactions
        WHERE DATE(transaction_date) = ? AND sc_pwd_id IS NOT NULL
      `;

      const result = db.prepare(scQuery).get(testDate) as any;

      expect(result.count).toBe(1);
      expect(result.sc_discount).toBe(13.39);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    test('handles decimal precision correctly', () => {
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 99.99,
        taxAmount: 10.71,
        discountAmount: 9.99,
        totalAmount: 90.00,
        paymentMethod: 'CASH',
        status: 'COMPLETED'
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      // gross_sales = 90.00 + 9.99 = 99.99
      expect(result.gross_sales).toBeCloseTo(99.99, 2);
      expect(result.discount_amount).toBeCloseTo(9.99, 2);
    });

    test('handles large amounts', () => {
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 999999.99,
        taxAmount: 107142.86,
        discountAmount: 0,
        totalAmount: 999999.99,
        paymentMethod: 'CASH',
        status: 'COMPLETED'
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      expect(result.gross_sales).toBeCloseTo(999999.99, 2);
    });

    test('handles multiple transactions on same day', () => {
      for (let i = 1; i <= 100; i++) {
        insertTransaction({
          invoiceNumber: `INV-${String(i).padStart(5, '0')}`,
          subtotal: 100,
          taxAmount: 10.71,
          discountAmount: 0,
          totalAmount: 100,
          paymentMethod: 'CASH',
          status: 'COMPLETED'
        });
      }

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      expect(result.transaction_count).toBe(100);
      expect(result.gross_sales).toBe(10000); // 100 * 100
      expect(result.cash_sales).toBe(10000);
    });

    test('filters by correct date', () => {
      // Transaction on test date
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 0, totalAmount: 100,
        paymentMethod: 'CASH', status: 'COMPLETED',
        transactionDate: `${testDate} 10:00:00`
      });

      // Transaction on different date
      db.prepare(`
        INSERT INTO transactions (
          transaction_number, invoice_number, subtotal, tax_amount, discount_amount,
          total_amount, payment_method, amount_tendered, change_amount,
          payment_status, cashier_id, status, transaction_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'TXN-OTHER', 'INV-002', 200, 21.43, 0, 200, 'CASH', 200, 0,
        'PAID', cashierId, 'COMPLETED', '2026-02-09 10:00:00', '2026-02-09 10:00:00'
      );

      const resultTestDate = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;
      const resultOtherDate = db.prepare(X_READING_SALES_QUERY).get('2026-02-09') as any;

      expect(resultTestDate.gross_sales).toBe(100);
      expect(resultOtherDate.gross_sales).toBe(200);
    });
  });

  // ========================================
  // COMPREHENSIVE OVER/SHORT CALCULATION TESTS
  // These tests verify cashier accountability
  // Over/Short = Actual Cash - Expected Cash
  // ========================================

  describe('Over/Short Calculation (Cashier Accountability)', () => {
    /**
     * Expected Cash Formula (from DatabaseService.ts line 7140):
     * Expected Cash = Beginning Cash + Cash Fund Net Balance + Cash Sales + AR Cash Payments
     *
     * Where Cash Fund Net Balance = opening_fund + cash_in - cash_out - petty_cash - cash_refunds
     */

    test('calculates expected cash with ALL cash-affecting transactions', () => {
      // Scenario: Complete day with all types of cash-affecting transactions
      const beginningCash = 500; // From previous day or settings

      // 1. Opening fund
      insertCashMovement({ movementType: 'OPENING_FUND', amount: 3000 });

      // 2. Additional cash in
      insertCashMovement({ movementType: 'CASH_IN', amount: 1000 });

      // 3. Cash out (bank deposit during day)
      insertCashMovement({ movementType: 'CASH_OUT', amount: 500 });

      // 4. Petty cash expenses
      insertCashMovement({ movementType: 'PETTY_CASH', amount: 200 });

      // 5. Cash refund for return
      insertCashMovement({ movementType: 'CASH_REFUND', amount: 150 });

      // 6. Cash sales
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 1000, taxAmount: 107.14, discountAmount: 0, totalAmount: 1000,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });
      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 500, taxAmount: 53.57, discountAmount: 50, totalAmount: 450,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // 7. Non-cash sales (should NOT affect expected cash)
      insertTransaction({
        invoiceNumber: 'INV-003',
        subtotal: 2000, taxAmount: 214.29, discountAmount: 0, totalAmount: 2000,
        paymentMethod: 'CARD', status: 'COMPLETED'
      });

      // 8. AR cash payment
      insertCustomerPayment({ paymentMethod: 'CASH', amountPaid: 300 });

      // 9. AR non-cash payment (should NOT affect expected cash)
      insertCustomerPayment({ paymentMethod: 'CARD', amountPaid: 500 });

      // Get all data
      const cashMovements = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;
      const salesData = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;
      const arPayments = db.prepare(CUSTOMER_PAYMENTS_QUERY).get(testDate) as any;

      // Calculate expected cash step by step
      // Cash Fund Net = 3000 + 1000 - 500 - 200 - 150 = 3150
      const cashFundNet = cashMovements.opening_fund + cashMovements.cash_in -
                          cashMovements.cash_out - cashMovements.petty_cash - cashMovements.cash_refunds;
      expect(cashFundNet).toBe(3150);

      // Cash Sales = 1000 + 450 = 1450 (only CASH payment method, COMPLETED)
      expect(salesData.cash_sales).toBe(1450);

      // AR Cash Payments = 300
      expect(arPayments.cash_payments).toBe(300);

      // Expected Cash = 500 + 3150 + 1450 + 300 = 5400
      const expectedCash = beginningCash + cashFundNet + salesData.cash_sales + arPayments.cash_payments;
      expect(expectedCash).toBe(5400);

      // Over/Short scenarios
      const actualCashExact = 5400;
      const actualCashOver = 5450;   // ₱50 over
      const actualCashShort = 5350;  // ₱50 short

      expect(actualCashExact - expectedCash).toBe(0);   // No over/short
      expect(actualCashOver - expectedCash).toBe(50);   // Over by 50
      expect(actualCashShort - expectedCash).toBe(-50); // Short by 50
    });

    test('VOID cash transactions do NOT contribute to expected cash', () => {
      // Critical test: Voided transactions should not be in expected cash
      // because the cashier never received the money
      const beginningCash = 1000;

      insertCashMovement({ movementType: 'OPENING_FUND', amount: 2000 });

      // Completed cash sale
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Voided cash sale (should NOT be in expected cash!)
      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 300, taxAmount: 32.14, discountAmount: 0, totalAmount: 300,
        paymentMethod: 'CASH', status: 'VOID'
      });

      const salesData = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;
      const cashMovements = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;

      // Cash sales should ONLY include COMPLETED transactions
      expect(salesData.cash_sales).toBe(500);  // NOT 800!
      expect(salesData.void_amount).toBe(300); // Void is tracked separately

      // Expected Cash = 1000 + 2000 + 500 = 3500 (NOT 3800!)
      const expectedCash = beginningCash + cashMovements.opening_fund + salesData.cash_sales;
      expect(expectedCash).toBe(3500);
    });

    test('cash refunds properly reduce expected cash', () => {
      const beginningCash = 1000;

      insertCashMovement({ movementType: 'OPENING_FUND', amount: 3000 });

      // Cash sale
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Cash refund (customer returned item, got cash back)
      insertCashMovement({ movementType: 'CASH_REFUND', amount: 200 });
      insertSalesReturn({ refundMethod: 'CASH', totalAmount: 200 });

      const cashMovements = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;
      const salesData = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      // Cash fund net = 3000 - 200 = 2800
      const cashFundNet = cashMovements.opening_fund - cashMovements.cash_refunds;
      expect(cashFundNet).toBe(2800);

      // Expected Cash = 1000 + 2800 + 500 = 4300
      const expectedCash = beginningCash + cashFundNet + salesData.cash_sales;
      expect(expectedCash).toBe(4300);
    });

    test('non-cash refunds do NOT affect expected cash', () => {
      const beginningCash = 1000;

      insertCashMovement({ movementType: 'OPENING_FUND', amount: 2000 });

      // Cash sale
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Store credit refund (no cash movement!)
      insertSalesReturn({ refundMethod: 'STORE_CREDIT', totalAmount: 200 });

      // Exchange (no cash movement!)
      insertSalesReturn({ refundMethod: 'EXCHANGE', totalAmount: 150 });

      const cashMovements = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;
      const salesData = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      // No cash refunds recorded
      expect(cashMovements.cash_refunds).toBe(0);

      // Expected Cash = 1000 + 2000 + 500 = 3500 (unaffected by non-cash refunds)
      const expectedCash = beginningCash + cashMovements.opening_fund + salesData.cash_sales;
      expect(expectedCash).toBe(3500);
    });

    test('mixed payment transactions - only CASH affects drawer', () => {
      const beginningCash = 500;

      insertCashMovement({ movementType: 'OPENING_FUND', amount: 1000 });

      // Cash transaction
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 0, totalAmount: 100,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Card transaction
      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 200, taxAmount: 21.43, discountAmount: 0, totalAmount: 200,
        paymentMethod: 'CARD', status: 'COMPLETED'
      });

      // Check transaction
      insertTransaction({
        invoiceNumber: 'INV-003',
        subtotal: 300, taxAmount: 32.14, discountAmount: 0, totalAmount: 300,
        paymentMethod: 'CHECK', status: 'COMPLETED'
      });

      // Online transaction
      insertTransaction({
        invoiceNumber: 'INV-004',
        subtotal: 400, taxAmount: 42.86, discountAmount: 0, totalAmount: 400,
        paymentMethod: 'ONLINE', status: 'COMPLETED'
      });

      // Charge invoice (AR)
      insertTransaction({
        invoiceNumber: 'INV-005',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CHARGE_INVOICE', status: 'COMPLETED'
      });

      const salesData = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;
      const cashMovements = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;

      // Only CASH should be in expected cash
      expect(salesData.cash_sales).toBe(100);
      expect(salesData.card_sales).toBe(200);
      expect(salesData.check_sales).toBe(300);
      expect(salesData.online_sales).toBe(400);
      expect(salesData.credit_sales).toBe(500);
      expect(salesData.gross_sales).toBe(1500); // Total of all

      // Expected Cash = 500 + 1000 + 100 (cash only) = 1600
      const expectedCash = beginningCash + cashMovements.opening_fund + salesData.cash_sales;
      expect(expectedCash).toBe(1600);
    });

    test('real-world scenario: full day operations', () => {
      /**
       * Real-world scenario simulating a complete business day:
       * - Morning: Open shift, add cash fund
       * - Throughout day: Various sales, refunds, AR payments
       * - End of day: Calculate expected vs actual
       */
      const beginningCash = 1000;

      // Morning: Cashier opens with ₱5,000 fund
      insertCashMovement({ movementType: 'OPENING_FUND', amount: 5000 });

      // Sale 1: Cash ₱150
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 150, taxAmount: 16.07, discountAmount: 0, totalAmount: 150,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Sale 2: Card ₱500 (no cash impact)
      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CARD', status: 'COMPLETED'
      });

      // Sale 3: Cash ₱320 with ₱20 SC discount
      insertTransaction({
        invoiceNumber: 'INV-003',
        subtotal: 320, taxAmount: 0, discountAmount: 20, totalAmount: 300,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Sale 4: Voided (customer changed mind) - NO CASH IMPACT
      insertTransaction({
        invoiceNumber: 'INV-004',
        subtotal: 200, taxAmount: 21.43, discountAmount: 0, totalAmount: 200,
        paymentMethod: 'CASH', status: 'VOID'
      });

      // Petty cash: Office supplies ₱85
      insertCashMovement({ movementType: 'PETTY_CASH', amount: 85 });

      // Return: Customer refund in cash ₱50
      insertCashMovement({ movementType: 'CASH_REFUND', amount: 50 });
      insertSalesReturn({ refundMethod: 'CASH', totalAmount: 50 });

      // AR Payment: Customer paid outstanding balance in cash ₱250
      insertCustomerPayment({ paymentMethod: 'CASH', amountPaid: 250 });

      // Sale 5: Online payment (GCash) ₱180 (no cash impact)
      insertTransaction({
        invoiceNumber: 'INV-005',
        subtotal: 180, taxAmount: 19.29, discountAmount: 0, totalAmount: 180,
        paymentMethod: 'ONLINE', status: 'COMPLETED'
      });

      // Bank deposit during day
      insertCashMovement({ movementType: 'CASH_OUT', amount: 2000 });

      // Additional cash fund added
      insertCashMovement({ movementType: 'CASH_IN', amount: 500 });

      // Calculate expected cash
      const cashMovements = db.prepare(CASH_MOVEMENTS_QUERY).get(testDate) as any;
      const salesData = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;
      const arPayments = db.prepare(CUSTOMER_PAYMENTS_QUERY).get(testDate) as any;

      // Verify cash movements
      expect(cashMovements.opening_fund).toBe(5000);
      expect(cashMovements.cash_in).toBe(500);
      expect(cashMovements.cash_out).toBe(2000);
      expect(cashMovements.petty_cash).toBe(85);
      expect(cashMovements.cash_refunds).toBe(50);

      // Cash fund net = 5000 + 500 - 2000 - 85 - 50 = 3365
      const cashFundNet = cashMovements.opening_fund + cashMovements.cash_in -
                          cashMovements.cash_out - cashMovements.petty_cash - cashMovements.cash_refunds;
      expect(cashFundNet).toBe(3365);

      // Verify sales
      expect(salesData.cash_sales).toBe(450);     // 150 + 300 (NOT including void!)
      expect(salesData.card_sales).toBe(500);
      expect(salesData.online_sales).toBe(180);
      expect(salesData.void_amount).toBe(200);    // Tracked separately
      expect(salesData.transaction_count).toBe(4); // 4 completed, void not counted

      // Verify AR payments
      expect(arPayments.cash_payments).toBe(250);

      // Expected Cash = 1000 + 3365 + 450 + 250 = 5065
      const expectedCash = beginningCash + cashFundNet + salesData.cash_sales + arPayments.cash_payments;
      expect(expectedCash).toBe(5065);

      // Simulate actual cash count by cashier
      const actualCash = 5065; // Perfect match
      const overShort = actualCash - expectedCash;
      expect(overShort).toBe(0); // No shortage, cashier is accountable

      // Simulate shortage scenario
      const actualCashShort = 5050; // ₱15 short
      expect(actualCashShort - expectedCash).toBe(-15);

      // Simulate over scenario
      const actualCashOver = 5080; // ₱15 over
      expect(actualCashOver - expectedCash).toBe(15);
    });

    test('multiple cashiers have separate accountability', () => {
      const cashier1 = 1;
      const cashier2 = 2;

      // Cashier 1 transactions
      insertCashMovement({ movementType: 'OPENING_FUND', amount: 3000 });
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Cashier 2 transactions (insert directly with different cashier_id)
      db.prepare(`
        INSERT INTO cash_movements (movement_type, amount, description, cashier_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('OPENING_FUND', 2000, 'Opening fund', cashier2, `${testDate} 08:00:00`);

      db.prepare(`
        INSERT INTO transactions (
          transaction_number, invoice_number, subtotal, tax_amount, discount_amount,
          total_amount, payment_method, amount_tendered, change_amount,
          payment_status, cashier_id, status, transaction_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'TXN-C2', 'INV-C2-001', 300, 32.14, 0, 300, 'CASH', 300, 0,
        'PAID', cashier2, 'COMPLETED', `${testDate} 09:00:00`, `${testDate} 09:00:00`
      );

      // Z-Reading filters by cashier
      const result1 = db.prepare(Z_READING_SALES_QUERY).get(testDate, cashier1) as any;
      const result2 = db.prepare(Z_READING_SALES_QUERY).get(testDate, cashier2) as any;

      expect(result1.gross_sales).toBe(500);  // Cashier 1's sales
      expect(result2.gross_sales).toBe(300);  // Cashier 2's sales
    });
  });

  // ========================================
  // X-READING AND Z-READING COMPLETE VALIDATION
  // ========================================

  describe('Complete X-Reading and Z-Reading Validation', () => {
    test('X-Reading totals match Z-Reading for same date', () => {
      insertCashMovement({ movementType: 'OPENING_FUND', amount: 5000 });

      // Multiple sales
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 1000, taxAmount: 107.14, discountAmount: 100, totalAmount: 900,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });
      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 500, taxAmount: 53.57, discountAmount: 0, totalAmount: 500,
        paymentMethod: 'CARD', status: 'COMPLETED'
      });
      insertTransaction({
        invoiceNumber: 'INV-003',
        subtotal: 300, taxAmount: 32.14, discountAmount: 0, totalAmount: 300,
        paymentMethod: 'CASH', status: 'VOID'
      });

      const xReading = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;
      const zReading = db.prepare(Z_READING_SALES_QUERY).get(testDate, cashierId) as any;

      // Gross sales comparison (X uses total+discount, Z uses total only)
      // X-Reading gross = (900+100) + (500+0) = 1500 (total + discount for completed)
      // Z-Reading gross = 900 + 500 = 1400 (just total for completed)
      expect(xReading.gross_sales).toBe(1500);
      expect(zReading.gross_sales).toBe(1400);

      // Void amounts should match
      expect(xReading.void_amount).toBe(300);
      expect(zReading.void_amount).toBe(300);

      // Discount should match
      expect(xReading.discount_amount).toBe(100);
      expect(zReading.discount_amount).toBe(100);
    });

    test('all payment types correctly recorded and totaled', () => {
      // Insert one of each payment type
      const payments = [
        { inv: 'INV-001', method: 'CASH', amount: 100 },
        { inv: 'INV-002', method: 'CARD', amount: 200 },
        { inv: 'INV-003', method: 'CHECK', amount: 300 },
        { inv: 'INV-004', method: 'ONLINE', amount: 400 },
        { inv: 'INV-005', method: 'CHARGE_INVOICE', amount: 500 },
      ];

      payments.forEach(p => {
        insertTransaction({
          invoiceNumber: p.inv,
          subtotal: p.amount, taxAmount: p.amount * 0.12 / 1.12, discountAmount: 0, totalAmount: p.amount,
          paymentMethod: p.method, status: 'COMPLETED'
        });
      });

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      expect(result.cash_sales).toBe(100);
      expect(result.card_sales).toBe(200);
      expect(result.check_sales).toBe(300);
      expect(result.online_sales).toBe(400);
      expect(result.credit_sales).toBe(500);

      // Total should be sum of all
      expect(result.gross_sales).toBe(1500);
      expect(result.transaction_count).toBe(5);
    });

    test('discounts properly tracked and separated', () => {
      // Regular sale with no discount
      insertTransaction({
        invoiceNumber: 'INV-001',
        subtotal: 100, taxAmount: 10.71, discountAmount: 0, totalAmount: 100,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // Percentage discount (10%)
      insertTransaction({
        invoiceNumber: 'INV-002',
        subtotal: 200, taxAmount: 19.29, discountAmount: 20, totalAmount: 180,
        paymentMethod: 'CASH', status: 'COMPLETED'
      });

      // SC discount (20%)
      db.prepare(`
        INSERT INTO transactions (
          transaction_number, invoice_number, subtotal, tax_amount, discount_amount,
          total_amount, payment_method, amount_tendered, change_amount,
          payment_status, cashier_id, status, sc_pwd_id, sc_pwd_name, sc_pwd_type,
          transaction_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'TXN-SC', 'INV-003', 89.29, 0, 17.86, 71.43,
        'CASH', 100, 28.57, 'PAID', cashierId, 'COMPLETED',
        'SC-12345', 'Juan Cruz', 'SENIOR',
        `${testDate} 10:00:00`, `${testDate} 10:00:00`
      );

      const result = db.prepare(X_READING_SALES_QUERY).get(testDate) as any;

      // Total discounts = 0 + 20 + 17.86 = 37.86
      expect(result.discount_amount).toBeCloseTo(37.86, 2);

      // Gross sales = (100+0) + (180+20) + (71.43+17.86) = 389.29
      expect(result.gross_sales).toBeCloseTo(389.29, 2);

      // Cash sales = actual amounts paid = 100 + 180 + 71.43 = 351.43
      expect(result.cash_sales).toBeCloseTo(351.43, 2);
    });
  });
});
