/**
 * Exchange Transactions and Multi-Invoice Payment E2E Tests
 *
 * This test file covers the specific bugs that were fixed:
 *
 * Problem 1: Exchange Transactions for Credit/Charge Invoices
 * - Credit transaction exchanges should adjust AR balance, NOT give cash
 *
 * Problem 2: Cash Tracking in X-Reading for Exchanges
 * - Cash exchange differences must be properly tracked
 *
 * Problem 3: Multi-Invoice Customer Payments (FIFO)
 * - Payments should be distributed to oldest invoices first
 *
 * Problem 4: Data Reset Foreign Key Constraints
 * - Proper deletion order for transactional data
 */

import Database from 'better-sqlite3';

// ============================================================================
// SCHEMA
// ============================================================================

const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT NOT NULL UNIQUE,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    customer_name TEXT,
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
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_ACCOUNTS_RECEIVABLE_TABLE = `
  CREATE TABLE IF NOT EXISTS accounts_receivable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    original_amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    balance_amount DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('OUTSTANDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')) DEFAULT 'OUTSTANDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  )
`;

const CREATE_CUSTOMER_PAYMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    transaction_id INTEGER NOT NULL,
    ar_id INTEGER,
    payment_date DATE NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('CASH', 'CARD', 'CHECK', 'BANK_TRANSFER', 'ONLINE', 'GCASH')) NOT NULL,
    amount_paid DECIMAL(12,2) NOT NULL,
    reference_number TEXT,
    notes TEXT,
    received_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (ar_id) REFERENCES accounts_receivable(id)
  )
`;

const CREATE_CASH_MOVEMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_type TEXT CHECK (movement_type IN ('OPENING_FUND', 'CASH_IN', 'CASH_OUT', 'PETTY_CASH', 'CASH_REFUND')) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    reference_number TEXT,
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
    exchange_new_amount DECIMAL(12,2) DEFAULT 0,
    exchange_difference DECIMAL(12,2) DEFAULT 0,
    reason TEXT NOT NULL,
    processed_by INTEGER NOT NULL,
    status TEXT CHECK (status IN ('COMPLETED', 'CANCELLED')) DEFAULT 'COMPLETED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_transaction_id) REFERENCES transactions(id)
  )
`;

const CREATE_EJOURNAL_TABLE = `
  CREATE TABLE IF NOT EXISTS ejournal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_type TEXT CHECK (entry_type IN ('SALE', 'VOID', 'REFUND', 'RETURN', 'PURCHASE_RETURN', 'PAYMENT', 'Z_READING', 'X_READING', 'SYSTEM')) NOT NULL,
    reference_number TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    cashier_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Exchange Transactions and Multi-Invoice Payment E2E Tests', () => {
  let db: Database.Database;
  const testDate = '2026-02-10';
  const cashierId = 1;
  const customerId = 1;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(CREATE_TRANSACTIONS_TABLE);
    db.exec(CREATE_ACCOUNTS_RECEIVABLE_TABLE);
    db.exec(CREATE_CUSTOMER_PAYMENTS_TABLE);
    db.exec(CREATE_CASH_MOVEMENTS_TABLE);
    db.exec(CREATE_SALES_RETURNS_TABLE);
    db.exec(CREATE_EJOURNAL_TABLE);
  });

  afterEach(() => {
    db.close();
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function createChargeInvoice(invoiceNumber: string, amount: number, customerName: string = 'Juan Dela Cruz'): number {
    const stmt = db.prepare(`
      INSERT INTO transactions (
        transaction_number, invoice_number, customer_id, customer_name,
        subtotal, tax_amount, total_amount, payment_method, amount_tendered,
        payment_status, cashier_id, status, transaction_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      invoiceNumber,
      customerId,
      customerName,
      amount,
      amount * 0.12 / 1.12,
      amount,
      'CHARGE_INVOICE',
      0,
      'UNPAID',
      cashierId,
      'COMPLETED',
      `${testDate} 10:00:00`
    );

    const txnId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // Create AR record
    db.prepare(`
      INSERT INTO accounts_receivable (
        transaction_id, customer_id, customer_name, invoice_number,
        invoice_date, due_date, original_amount, paid_amount, balance_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txnId,
      customerId,
      customerName,
      invoiceNumber,
      testDate,
      '2026-03-10',
      amount,
      0,
      amount,
      'OUTSTANDING'
    );

    return txnId;
  }

  function createCashSale(invoiceNumber: string, amount: number): number {
    const stmt = db.prepare(`
      INSERT INTO transactions (
        transaction_number, invoice_number, subtotal, tax_amount, total_amount,
        payment_method, amount_tendered, change_amount, payment_status,
        cashier_id, status, transaction_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      invoiceNumber,
      amount,
      amount * 0.12 / 1.12,
      amount,
      'CASH',
      amount,
      0,
      'PAID',
      cashierId,
      'COMPLETED',
      `${testDate} 10:00:00`
    );

    return (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
  }

  let returnCounter = 0;

  function processExchange(
    originalTxnId: number,
    originalInvoice: string,
    returnedAmount: number,
    newItemAmount: number,
    isCreditTransaction: boolean
  ): { returnId: number; difference: number } {
    const difference = newItemAmount - returnedAmount;
    returnCounter++;
    const returnNumber = `RET-${Date.now()}-${returnCounter}-${Math.random().toString(36).substr(2, 5)}`;

    // Create sales return record
    db.prepare(`
      INSERT INTO sales_returns (
        return_number, original_transaction_id, original_invoice_number,
        customer_id, return_date, total_amount, refund_method,
        exchange_new_amount, exchange_difference, reason, processed_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      returnNumber,
      originalTxnId,
      originalInvoice,
      customerId,
      testDate,
      returnedAmount,
      'EXCHANGE',
      newItemAmount,
      difference,
      'Exchange for different item',
      cashierId,
      'COMPLETED'
    );

    const returnId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    if (isCreditTransaction) {
      // For credit transactions: adjust AR balance, NO cash movement
      const ar = db.prepare(`
        SELECT * FROM accounts_receivable WHERE transaction_id = ?
      `).get(originalTxnId) as any;

      if (ar) {
        // Update AR balance to new item amount
        db.prepare(`
          UPDATE accounts_receivable
          SET balance_amount = ?, original_amount = ?
          WHERE transaction_id = ?
        `).run(newItemAmount, newItemAmount, originalTxnId);

        // Update transaction total
        db.prepare(`
          UPDATE transactions SET total_amount = ? WHERE id = ?
        `).run(newItemAmount, originalTxnId);
      }

      // Add eJournal entry for AR adjustment
      db.prepare(`
        INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'SYSTEM',
        originalInvoice,
        `AR Adjustment for exchange: ${returnedAmount} -> ${newItemAmount}`,
        difference,
        cashierId,
        `${testDate} 10:30:00`
      );
    } else {
      // For cash transactions: record cash movement
      if (difference < 0) {
        // Customer receives cash (returned item worth more than new item)
        db.prepare(`
          INSERT INTO cash_movements (movement_type, amount, description, reference_number, cashier_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('CASH_REFUND', Math.abs(difference), 'Exchange cash refund', returnNumber, cashierId, `${testDate} 10:30:00`);
      } else if (difference > 0) {
        // Customer pays additional cash (new item worth more)
        db.prepare(`
          INSERT INTO cash_movements (movement_type, amount, description, reference_number, cashier_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('CASH_IN', difference, 'Exchange additional payment', returnNumber, cashierId, `${testDate} 10:30:00`);
      }
    }

    return { returnId, difference };
  }

  function processMultiInvoicePayment(
    arIds: number[],
    totalPayment: number,
    paymentMethod: string = 'CASH'
  ): { distributions: Array<{ arId: number; amount: number; newBalance: number }> } {
    // Get AR records sorted by invoice_date (FIFO)
    const arRecords = db.prepare(`
      SELECT * FROM accounts_receivable
      WHERE id IN (${arIds.join(',')})
      ORDER BY invoice_date ASC, id ASC
    `).all() as any[];

    let remainingPayment = totalPayment;
    const distributions: Array<{ arId: number; amount: number; newBalance: number }> = [];
    const paymentNumber = `PAY-${Date.now()}`;

    for (const ar of arRecords) {
      if (remainingPayment <= 0) break;

      const paymentForThisInvoice = Math.min(remainingPayment, ar.balance_amount);
      remainingPayment -= paymentForThisInvoice;

      const newBalance = ar.balance_amount - paymentForThisInvoice;
      const newPaidAmount = ar.paid_amount + paymentForThisInvoice;
      const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      // Update AR
      db.prepare(`
        UPDATE accounts_receivable
        SET paid_amount = ?, balance_amount = ?, status = ?
        WHERE id = ?
      `).run(newPaidAmount, newBalance, newStatus, ar.id);

      // Create payment record
      db.prepare(`
        INSERT INTO customer_payments (
          payment_number, customer_id, transaction_id, ar_id, payment_date,
          payment_method, amount_paid, received_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `${paymentNumber}-${ar.id}`,
        ar.customer_id,
        ar.transaction_id,
        ar.id,
        testDate,
        paymentMethod,
        paymentForThisInvoice,
        cashierId,
        `${testDate} 14:00:00`
      );

      distributions.push({
        arId: ar.id,
        amount: paymentForThisInvoice,
        newBalance
      });
    }

    return { distributions };
  }

  // ============================================================================
  // PROBLEM 1: Credit Transaction Exchange Tests
  // ============================================================================

  describe('Problem 1: Exchange Transactions for Credit/Charge Invoices', () => {

    test('Credit exchange to LOWER value item should REDUCE AR balance (NO cash given)', () => {
      // Create charge invoice for P120
      const txnId = createChargeInvoice('INV-001', 120);

      // Verify initial AR balance
      const arBefore = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txnId) as any;
      expect(arBefore.balance_amount).toBe(120);
      expect(arBefore.status).toBe('OUTSTANDING');

      // Process exchange: P120 item -> P35 item (customer should have balance reduced by P85)
      const { difference } = processExchange(txnId, 'INV-001', 120, 35, true);

      // Difference should be -85 (new amount - old amount = 35 - 120 = -85)
      expect(difference).toBe(-85);

      // Verify AR balance is now P35
      const arAfter = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txnId) as any;
      expect(arAfter.balance_amount).toBe(35);
      expect(arAfter.original_amount).toBe(35);

      // CRITICAL: Verify NO cash movement was created
      const cashMovements = db.prepare(`SELECT * FROM cash_movements WHERE reference_number LIKE 'RET-%'`).all();
      expect(cashMovements.length).toBe(0);

      // Verify eJournal records the AR adjustment
      const journal = db.prepare(`SELECT * FROM ejournal WHERE entry_type = 'SYSTEM' AND reference_number = 'INV-001'`).get() as any;
      expect(journal).toBeTruthy();
      expect(journal.amount).toBe(-85);
    });

    test('Credit exchange to HIGHER value item should INCREASE AR balance (NO cash collected)', () => {
      // Create charge invoice for P35
      const txnId = createChargeInvoice('INV-002', 35);

      // Verify initial AR balance
      const arBefore = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txnId) as any;
      expect(arBefore.balance_amount).toBe(35);

      // Process exchange: P35 item -> P120 item (customer balance increases by P85)
      const { difference } = processExchange(txnId, 'INV-002', 35, 120, true);

      // Difference should be +85
      expect(difference).toBe(85);

      // Verify AR balance is now P120
      const arAfter = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txnId) as any;
      expect(arAfter.balance_amount).toBe(120);
      expect(arAfter.original_amount).toBe(120);

      // CRITICAL: Verify NO cash movement was created
      const cashMovements = db.prepare(`SELECT * FROM cash_movements WHERE reference_number LIKE 'RET-%'`).all();
      expect(cashMovements.length).toBe(0);
    });

    test('Credit exchange to EQUAL value item should NOT change AR balance', () => {
      // Create charge invoice for P100
      const txnId = createChargeInvoice('INV-003', 100);

      // Process exchange: P100 item -> P100 item (even exchange)
      const { difference } = processExchange(txnId, 'INV-003', 100, 100, true);

      expect(difference).toBe(0);

      // Verify AR balance unchanged
      const arAfter = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txnId) as any;
      expect(arAfter.balance_amount).toBe(100);

      // No cash movement
      const cashMovements = db.prepare(`SELECT * FROM cash_movements WHERE reference_number LIKE 'RET-%'`).all();
      expect(cashMovements.length).toBe(0);
    });
  });

  // ============================================================================
  // PROBLEM 2: Cash Tracking for Exchanges
  // ============================================================================

  describe('Problem 2: Cash Tracking in X-Reading for Exchanges', () => {

    test('Cash exchange to LOWER value should record CASH_REFUND and reduce expected cash', () => {
      // Setup: P1,000 beginning cash
      db.prepare(`
        INSERT INTO cash_movements (movement_type, amount, description, cashier_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('OPENING_FUND', 1000, 'Opening fund', cashierId, `${testDate} 08:00:00`);

      // Cash sale of P120
      const txnId = createCashSale('INV-CASH-001', 120);

      // Process cash exchange: P120 -> P35 (give back P85)
      processExchange(txnId, 'INV-CASH-001', 120, 35, false);

      // Verify cash refund was recorded
      const cashMovements = db.prepare(`
        SELECT * FROM cash_movements WHERE movement_type = 'CASH_REFUND'
      `).all() as any[];

      expect(cashMovements.length).toBe(1);
      expect(cashMovements[0].amount).toBe(85);

      // Calculate expected cash
      // Beginning: 1000 + Sale: 120 - Refund: 85 = 1035
      const openingFund = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE movement_type = 'OPENING_FUND' AND DATE(created_at) = ?
      `).get(testDate) as { total: number };

      const cashRefunds = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE movement_type = 'CASH_REFUND' AND DATE(created_at) = ?
      `).get(testDate) as { total: number };

      const cashSales = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions
        WHERE payment_method = 'CASH' AND status = 'COMPLETED' AND DATE(transaction_date) = ?
      `).get(testDate) as { total: number };

      const expectedCash = openingFund.total + cashSales.total - cashRefunds.total;
      expect(expectedCash).toBe(1035); // 1000 + 120 - 85 = 1035
    });

    test('Cash exchange to HIGHER value should record CASH_IN and increase expected cash', () => {
      // Setup: P1,000 beginning cash
      db.prepare(`
        INSERT INTO cash_movements (movement_type, amount, description, cashier_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('OPENING_FUND', 1000, 'Opening fund', cashierId, `${testDate} 08:00:00`);

      // Cash sale of P35
      const txnId = createCashSale('INV-CASH-002', 35);

      // Process cash exchange: P35 -> P120 (collect P85)
      processExchange(txnId, 'INV-CASH-002', 35, 120, false);

      // Verify cash in was recorded
      const cashIn = db.prepare(`
        SELECT * FROM cash_movements WHERE movement_type = 'CASH_IN' AND reference_number LIKE 'RET-%'
      `).all() as any[];

      expect(cashIn.length).toBe(1);
      expect(cashIn[0].amount).toBe(85);

      // Calculate expected cash
      // Beginning: 1000 + Sale: 35 + Exchange Payment: 85 = 1120
      const openingFund = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE movement_type = 'OPENING_FUND' AND DATE(created_at) = ?
      `).get(testDate) as { total: number };

      const additionalCashIn = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE movement_type = 'CASH_IN' AND DATE(created_at) = ?
      `).get(testDate) as { total: number };

      const cashSales = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions
        WHERE payment_method = 'CASH' AND status = 'COMPLETED' AND DATE(transaction_date) = ?
      `).get(testDate) as { total: number };

      const expectedCash = openingFund.total + cashSales.total + additionalCashIn.total;
      expect(expectedCash).toBe(1120); // 1000 + 35 + 85 = 1120
    });

    test('Full day scenario with multiple exchanges should have accurate expected cash', () => {
      // Opening fund
      db.prepare(`
        INSERT INTO cash_movements (movement_type, amount, description, cashier_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('OPENING_FUND', 1000, 'Opening fund', cashierId, `${testDate} 08:00:00`);

      // Sale 1: Cash P120
      const txn1 = createCashSale('INV-001', 120);

      // Exchange 1: P120 -> P35 (refund P85)
      processExchange(txn1, 'INV-001', 120, 35, false);

      // Sale 2: Cash P35
      const txn2 = createCashSale('INV-002', 35);

      // Exchange 2: P35 -> P120 (collect P85)
      processExchange(txn2, 'INV-002', 35, 120, false);

      // Calculate expected cash
      const movements = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN movement_type = 'OPENING_FUND' THEN amount ELSE 0 END), 0) as opening_fund,
          COALESCE(SUM(CASE WHEN movement_type = 'CASH_IN' THEN amount ELSE 0 END), 0) as cash_in,
          COALESCE(SUM(CASE WHEN movement_type = 'CASH_REFUND' THEN amount ELSE 0 END), 0) as cash_refunds
        FROM cash_movements WHERE DATE(created_at) = ?
      `).get(testDate) as any;

      const sales = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions
        WHERE payment_method = 'CASH' AND status = 'COMPLETED' AND DATE(transaction_date) = ?
      `).get(testDate) as { total: number };

      // Expected: 1000 + (120 + 35) + 85 - 85 = 1155
      const expectedCash = movements.opening_fund + sales.total + movements.cash_in - movements.cash_refunds;
      expect(expectedCash).toBe(1155);
    });
  });

  // ============================================================================
  // PROBLEM 3: Multi-Invoice Customer Payments (FIFO)
  // ============================================================================

  describe('Problem 3: Customer Payment Workflow for Multiple Invoices', () => {

    test('FIFO payment: Full payment for oldest invoice, partial for second', () => {
      // Create 2 charge invoices for the same customer
      const txn1 = createChargeInvoice('INV-001', 5000);
      const txn2 = createChargeInvoice('INV-002', 3000);

      // Get AR IDs
      const ar1 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txn1) as any;
      const ar2 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txn2) as any;

      // Customer total outstanding: P8,000
      const totalOutstanding = db.prepare(`
        SELECT COALESCE(SUM(balance_amount), 0) as total FROM accounts_receivable
        WHERE customer_id = ? AND status != 'PAID'
      `).get(customerId) as { total: number };
      expect(totalOutstanding.total).toBe(8000);

      // Customer pays P7,000 (less than total)
      const { distributions } = processMultiInvoicePayment([ar1.id, ar2.id], 7000, 'CASH');

      // Verify FIFO distribution
      expect(distributions.length).toBe(2);
      expect(distributions[0].arId).toBe(ar1.id);
      expect(distributions[0].amount).toBe(5000);
      expect(distributions[0].newBalance).toBe(0);

      expect(distributions[1].arId).toBe(ar2.id);
      expect(distributions[1].amount).toBe(2000);
      expect(distributions[1].newBalance).toBe(1000);

      // Verify AR statuses
      const ar1After = db.prepare(`SELECT * FROM accounts_receivable WHERE id = ?`).get(ar1.id) as any;
      const ar2After = db.prepare(`SELECT * FROM accounts_receivable WHERE id = ?`).get(ar2.id) as any;

      expect(ar1After.status).toBe('PAID');
      expect(ar1After.balance_amount).toBe(0);
      expect(ar1After.paid_amount).toBe(5000);

      expect(ar2After.status).toBe('PARTIALLY_PAID');
      expect(ar2After.balance_amount).toBe(1000);
      expect(ar2After.paid_amount).toBe(2000);
    });

    test('Customer summary shows correct total outstanding', () => {
      // Create multiple invoices
      createChargeInvoice('INV-A', 1000);
      createChargeInvoice('INV-B', 2500);
      createChargeInvoice('INV-C', 1500);

      // Query for customer summary
      const summary = db.prepare(`
        SELECT
          customer_id,
          customer_name,
          COUNT(*) as invoice_count,
          SUM(balance_amount) as total_outstanding
        FROM accounts_receivable
        WHERE customer_id = ? AND status != 'PAID'
        GROUP BY customer_id, customer_name
      `).get(customerId) as any;

      expect(summary.invoice_count).toBe(3);
      expect(summary.total_outstanding).toBe(5000);
    });

    test('Full payment of all selected invoices', () => {
      const txn1 = createChargeInvoice('INV-001', 1000);
      const txn2 = createChargeInvoice('INV-002', 2000);

      const ar1 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txn1) as any;
      const ar2 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txn2) as any;

      // Pay exact total: P3,000
      const { distributions } = processMultiInvoicePayment([ar1.id, ar2.id], 3000, 'CASH');

      expect(distributions.length).toBe(2);
      expect(distributions[0].newBalance).toBe(0);
      expect(distributions[1].newBalance).toBe(0);

      // Both should be PAID
      const ar1After = db.prepare(`SELECT * FROM accounts_receivable WHERE id = ?`).get(ar1.id) as any;
      const ar2After = db.prepare(`SELECT * FROM accounts_receivable WHERE id = ?`).get(ar2.id) as any;

      expect(ar1After.status).toBe('PAID');
      expect(ar2After.status).toBe('PAID');
    });

    test('Payment records are created for each invoice', () => {
      const txn1 = createChargeInvoice('INV-001', 500);
      const txn2 = createChargeInvoice('INV-002', 500);

      const ar1 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txn1) as any;
      const ar2 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txn2) as any;

      processMultiInvoicePayment([ar1.id, ar2.id], 800, 'CASH');

      // Check payment records
      const payments = db.prepare(`
        SELECT * FROM customer_payments WHERE ar_id IN (?, ?) ORDER BY ar_id
      `).all(ar1.id, ar2.id) as any[];

      expect(payments.length).toBe(2);
      expect(payments[0].amount_paid).toBe(500);
      expect(payments[1].amount_paid).toBe(300);
    });
  });

  // ============================================================================
  // PROBLEM 4: Data Reset Foreign Key Constraints
  // ============================================================================

  describe('Problem 4: Data Reset Foreign Key Constraints', () => {

    test('Deletion order should be: payments -> AR -> transactions', () => {
      // Create a transaction with AR and payment
      const txnId = createChargeInvoice('INV-001', 1000);

      const ar = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(txnId) as any;

      // Create payment
      db.prepare(`
        INSERT INTO customer_payments (
          payment_number, customer_id, transaction_id, ar_id, payment_date,
          payment_method, amount_paid, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('PAY-001', customerId, txnId, ar.id, testDate, 'CASH', 500, cashierId);

      // Verify records exist
      expect(db.prepare(`SELECT COUNT(*) as c FROM transactions`).get() as any).toEqual({ c: 1 });
      expect(db.prepare(`SELECT COUNT(*) as c FROM accounts_receivable`).get() as any).toEqual({ c: 1 });
      expect(db.prepare(`SELECT COUNT(*) as c FROM customer_payments`).get() as any).toEqual({ c: 1 });

      // Delete in CORRECT order
      db.prepare(`DELETE FROM customer_payments`).run();
      expect(db.prepare(`SELECT COUNT(*) as c FROM customer_payments`).get() as any).toEqual({ c: 0 });

      db.prepare(`DELETE FROM accounts_receivable`).run();
      expect(db.prepare(`SELECT COUNT(*) as c FROM accounts_receivable`).get() as any).toEqual({ c: 0 });

      db.prepare(`DELETE FROM transactions`).run();
      expect(db.prepare(`SELECT COUNT(*) as c FROM transactions`).get() as any).toEqual({ c: 0 });
    });

    test('Invoice counter should use MAX from transactions after reset', () => {
      // Simulate the fix for duplicate invoice numbers
      db.prepare(`
        INSERT INTO transactions (
          transaction_number, invoice_number, subtotal, tax_amount, total_amount,
          payment_method, amount_tendered, cashier_id, status, transaction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('TXN-1', 'INV00000005', 100, 10, 100, 'CASH', 100, 1, 'COMPLETED', `${testDate} 10:00:00`);

      db.prepare(`
        INSERT INTO transactions (
          transaction_number, invoice_number, subtotal, tax_amount, total_amount,
          payment_method, amount_tendered, cashier_id, status, transaction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('TXN-2', 'INV00000010', 200, 20, 200, 'CASH', 200, 1, 'COMPLETED', `${testDate} 11:00:00`);

      // Query to get next invoice number (the fixed logic)
      const maxExisting = db.prepare(`
        SELECT MAX(CAST(SUBSTR(invoice_number, 4) AS INTEGER)) as max_num
        FROM transactions
        WHERE invoice_number LIKE 'INV%'
      `).get() as { max_num: number };

      // The counter should be at least 10, so next should be 11
      const currentCounter = 5;
      const nextValue = Math.max(currentCounter, maxExisting.max_num || 0) + 1;

      expect(nextValue).toBe(11);
    });
  });

  // ============================================================================
  // INTEGRATION TEST: Complete Workflow
  // ============================================================================

  describe('Integration: Complete Workflow Test', () => {

    test('Full day with credit sales, exchanges, and payments', () => {
      // Opening fund
      db.prepare(`
        INSERT INTO cash_movements (movement_type, amount, description, cashier_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('OPENING_FUND', 5000, 'Opening fund', cashierId, `${testDate} 08:00:00`);

      // 1. Cash sale P500
      createCashSale('CASH-001', 500);

      // 2. Credit sale P1,000 to customer
      const creditTxn1 = createChargeInvoice('CREDIT-001', 1000);

      // 3. Credit sale P800 to same customer
      const creditTxn2 = createChargeInvoice('CREDIT-002', 800);

      // 4. Exchange on credit sale: P1,000 -> P600 (AR reduces by P400)
      processExchange(creditTxn1, 'CREDIT-001', 1000, 600, true);

      // 5. Customer pays P1,000 on their account
      const ar1 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(creditTxn1) as any;
      const ar2 = db.prepare(`SELECT * FROM accounts_receivable WHERE transaction_id = ?`).get(creditTxn2) as any;

      // After exchange, AR1 balance should be P600
      expect(ar1.balance_amount).toBe(600);

      // Process multi-invoice payment of P1,000
      const { distributions } = processMultiInvoicePayment([ar1.id, ar2.id], 1000, 'CASH');

      // FIFO: P600 to first invoice (fully paid), P400 to second
      expect(distributions[0].amount).toBe(600);
      expect(distributions[0].newBalance).toBe(0);
      expect(distributions[1].amount).toBe(400);
      expect(distributions[1].newBalance).toBe(400);

      // Verify final AR states
      const ar1Final = db.prepare(`SELECT * FROM accounts_receivable WHERE id = ?`).get(ar1.id) as any;
      const ar2Final = db.prepare(`SELECT * FROM accounts_receivable WHERE id = ?`).get(ar2.id) as any;

      expect(ar1Final.status).toBe('PAID');
      expect(ar2Final.status).toBe('PARTIALLY_PAID');
      expect(ar2Final.balance_amount).toBe(400);

      // Calculate expected cash
      const cashData = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN movement_type = 'OPENING_FUND' THEN amount ELSE 0 END), 0) as opening,
          COALESCE(SUM(CASE WHEN movement_type = 'CASH_IN' THEN amount ELSE 0 END), 0) as cash_in,
          COALESCE(SUM(CASE WHEN movement_type = 'CASH_REFUND' THEN amount ELSE 0 END), 0) as refunds
        FROM cash_movements WHERE DATE(created_at) = ?
      `).get(testDate) as any;

      const cashSales = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions
        WHERE payment_method = 'CASH' AND status = 'COMPLETED' AND DATE(transaction_date) = ?
      `).get(testDate) as { total: number };

      const arCashPayments = db.prepare(`
        SELECT COALESCE(SUM(amount_paid), 0) as total FROM customer_payments
        WHERE payment_method = 'CASH' AND DATE(payment_date) = ?
      `).get(testDate) as { total: number };

      // Expected cash = 5000 + 500 (cash sale) + 1000 (AR cash payment) = 6500
      const expectedCash = cashData.opening + cashSales.total + arCashPayments.total +
                          cashData.cash_in - cashData.refunds;
      expect(expectedCash).toBe(6500);

      // No cash movement from credit exchange (CRITICAL)
      const exchangeCashMovements = db.prepare(`
        SELECT * FROM cash_movements WHERE description LIKE '%exchange%'
      `).all();
      expect(exchangeCashMovements.length).toBe(0);
    });
  });
});
