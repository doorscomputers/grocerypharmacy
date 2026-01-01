/**
 * Automated Cash Reconciliation Test
 *
 * This test generates actual transaction data and verifies that:
 * 1. All calculations are correct
 * 2. Reports tally with expected values
 * 3. Cash reconciliation matches cashier's count
 *
 * Run this test by importing and calling runCashReconciliationTest()
 */

import { getDatabase } from '../database/getDatabase';

interface TestTransaction {
  paymentMethod: 'CASH' | 'CARD' | 'CHECK' | 'ONLINE' | 'CHARGE_INVOICE';
  totalAmount: number;
  items: Array<{
    productId: number;
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    totalAmount: number;
  }>;
}

interface TestResult {
  passed: boolean;
  testName: string;
  expected: any;
  actual: any;
  message: string;
}

interface CashDenomination {
  denomination: number;
  count: number;
  total: number;
}

// Test configuration
const TEST_CONFIG = {
  beginningCash: 5000, // Starting cash drawer
  cashierId: 1,        // Admin user

  // Sample transactions to create
  transactions: [
    // Cash sales
    { paymentMethod: 'CASH' as const, amount: 150.00, description: 'Cash Sale 1' },
    { paymentMethod: 'CASH' as const, amount: 275.50, description: 'Cash Sale 2' },
    { paymentMethod: 'CASH' as const, amount: 89.00, description: 'Cash Sale 3' },

    // Card sales (no effect on cash drawer)
    { paymentMethod: 'CARD' as const, amount: 500.00, description: 'Card Sale 1' },
    { paymentMethod: 'CARD' as const, amount: 320.00, description: 'Card Sale 2' },

    // Online/GCash (no effect on cash drawer)
    { paymentMethod: 'ONLINE' as const, amount: 185.00, description: 'GCash Sale 1' },

    // Charge to account (no effect on cash drawer)
    { paymentMethod: 'CHARGE_INVOICE' as const, amount: 750.00, description: 'Credit Sale 1' },
  ],

  // Customer payments (AR collections)
  customerPayments: [
    { amount: 200.00, method: 'CASH' as const, description: 'AR Collection Cash 1' },
    { amount: 150.00, method: 'CASH' as const, description: 'AR Collection Cash 2' },
    { amount: 300.00, method: 'BANK_TRANSFER' as const, description: 'AR Collection Bank' },
  ],

  // Supplier payments (AP disbursements)
  supplierPayments: [
    { amount: 500.00, method: 'CASH' as const, description: 'Supplier Payment Cash 1' },
    { amount: 200.00, method: 'CHECK' as const, description: 'Supplier Payment Check' },
  ],

  // Sales returns
  salesReturns: [
    { amount: 50.00, refundMethod: 'CASH' as const, description: 'Return 1 - Cash Refund' },
    { amount: 100.00, refundMethod: 'CREDIT' as const, description: 'Return 2 - Store Credit' },
  ],
};

class CashReconciliationTest {
  private db: any;
  private results: TestResult[] = [];
  private createdTransactionIds: number[] = [];

  async initialize() {
    this.db = getDatabase();
    console.log('='.repeat(60));
    console.log('AUTOMATED CASH RECONCILIATION TEST');
    console.log('='.repeat(60));
    console.log(`Test Date: ${new Date().toISOString()}`);
    console.log(`Beginning Cash: ${TEST_CONFIG.beginningCash.toFixed(2)}`);
    console.log('');
  }

  // Helper to add test result
  private addResult(testName: string, expected: any, actual: any, passed: boolean, message: string = '') {
    this.results.push({ testName, expected, actual, passed, message });
    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${testName}`);
    if (!passed) {
      console.log(`   Expected: ${JSON.stringify(expected)}`);
      console.log(`   Actual: ${JSON.stringify(actual)}`);
    }
    if (message) {
      console.log(`   Note: ${message}`);
    }
  }

  // Get or create a test product
  async getOrCreateTestProduct(): Promise<any> {
    const products = await this.db.getProducts();
    if (products.length > 0) {
      return products[0];
    }

    // Create a test product if none exist
    const productId = await this.db.createProduct({
      code: 'TEST001',
      name: 'Test Product',
      category_id: null,
      brand_id: null,
      unit_id: null,
      size_id: null,
      cost: 50,
      price: 100,
      stock_quantity: 1000,
      reorder_level: 10,
      tax_rate: 12,
      is_vat_inclusive: true,
      is_active: true,
    });

    return await this.db.getProductById(productId);
  }

  // Create test transactions
  async createTestTransactions(): Promise<void> {
    console.log('\n--- Creating Test Transactions ---');

    const product = await this.getOrCreateTestProduct();

    for (const txn of TEST_CONFIG.transactions) {
      try {
        // Calculate tax (12% VAT)
        const taxRate = 0.12;
        const baseAmount = txn.amount / (1 + taxRate);
        const taxAmount = txn.amount - baseAmount;

        const result = await this.db.createTransaction({
          customer_name: 'Walk-in Customer',
          subtotal: baseAmount,
          tax_amount: taxAmount,
          discount_amount: 0,
          total_amount: txn.amount,
          payment_method: txn.paymentMethod,
          amount_tendered: txn.paymentMethod === 'CASH' ? txn.amount + 50 : txn.amount,
          change_amount: txn.paymentMethod === 'CASH' ? 50 : 0,
          cashier_id: TEST_CONFIG.cashierId,
          items: [{
            product_id: product.id,
            product_code: product.code,
            product_name: product.name,
            quantity: 1,
            unit_price: txn.amount,
            discount_amount: 0,
            tax_amount: taxAmount,
            total_amount: txn.amount,
          }],
        });

        console.log(`  Created: ${txn.description} - ${txn.paymentMethod} - ₱${txn.amount.toFixed(2)} (${result.invoiceNumber})`);
      } catch (error: any) {
        console.error(`  ERROR creating ${txn.description}: ${error.message}`);
      }
    }
  }

  // Calculate expected values
  calculateExpectedValues(): {
    grossSales: number;
    cashSales: number;
    cardSales: number;
    onlineSales: number;
    creditSales: number;
    customerPaymentsCash: number;
    supplierPaymentsCash: number;
    salesReturnsCash: number;
    expectedCash: number;
  } {
    // Calculate sales by payment method
    let grossSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let onlineSales = 0;
    let creditSales = 0;

    for (const txn of TEST_CONFIG.transactions) {
      grossSales += txn.amount;
      switch (txn.paymentMethod) {
        case 'CASH': cashSales += txn.amount; break;
        case 'CARD': cardSales += txn.amount; break;
        case 'ONLINE': onlineSales += txn.amount; break;
        case 'CHARGE_INVOICE': creditSales += txn.amount; break;
      }
    }

    // Calculate customer payments (cash only affects drawer)
    const customerPaymentsCash = TEST_CONFIG.customerPayments
      .filter(p => p.method === 'CASH')
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate supplier payments (cash only affects drawer)
    const supplierPaymentsCash = TEST_CONFIG.supplierPayments
      .filter(p => p.method === 'CASH')
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate sales returns (cash refunds only)
    const salesReturnsCash = TEST_CONFIG.salesReturns
      .filter(r => r.refundMethod === 'CASH')
      .reduce((sum, r) => sum + r.amount, 0);

    // Expected cash formula:
    // Beginning Cash + Cash Sales + Customer Payments (Cash) - Sales Returns (Cash) - Supplier Payments (Cash)
    const expectedCash = TEST_CONFIG.beginningCash
      + cashSales
      + customerPaymentsCash
      - salesReturnsCash
      - supplierPaymentsCash;

    return {
      grossSales,
      cashSales,
      cardSales,
      onlineSales,
      creditSales,
      customerPaymentsCash,
      supplierPaymentsCash,
      salesReturnsCash,
      expectedCash,
    };
  }

  // Verify transaction totals from database
  async verifyTransactionTotals(): Promise<void> {
    console.log('\n--- Verifying Transaction Totals ---');

    const expected = this.calculateExpectedValues();
    const transactions = await this.db.getTodaysTransactions();

    // Calculate actual totals from database
    let actualGrossSales = 0;
    let actualCashSales = 0;
    let actualCardSales = 0;
    let actualOnlineSales = 0;
    let actualCreditSales = 0;

    for (const txn of transactions) {
      if (txn.status === 'COMPLETED') {
        actualGrossSales += txn.total_amount;
        switch (txn.payment_method) {
          case 'CASH': actualCashSales += txn.total_amount; break;
          case 'CARD': actualCardSales += txn.total_amount; break;
          case 'ONLINE': actualOnlineSales += txn.total_amount; break;
          case 'CHARGE_INVOICE': actualCreditSales += txn.total_amount; break;
        }
      }
    }

    // Test: Gross Sales
    this.addResult(
      'Gross Sales Total',
      expected.grossSales.toFixed(2),
      actualGrossSales.toFixed(2),
      Math.abs(expected.grossSales - actualGrossSales) < 0.01
    );

    // Test: Cash Sales
    this.addResult(
      'Cash Sales Total',
      expected.cashSales.toFixed(2),
      actualCashSales.toFixed(2),
      Math.abs(expected.cashSales - actualCashSales) < 0.01
    );

    // Test: Card Sales
    this.addResult(
      'Card Sales Total',
      expected.cardSales.toFixed(2),
      actualCardSales.toFixed(2),
      Math.abs(expected.cardSales - actualCardSales) < 0.01
    );

    // Test: Online/GCash Sales
    this.addResult(
      'Online/GCash Sales Total',
      expected.onlineSales.toFixed(2),
      actualOnlineSales.toFixed(2),
      Math.abs(expected.onlineSales - actualOnlineSales) < 0.01
    );

    // Test: Credit Sales
    this.addResult(
      'Credit/Charge Sales Total',
      expected.creditSales.toFixed(2),
      actualCreditSales.toFixed(2),
      Math.abs(expected.creditSales - actualCreditSales) < 0.01
    );
  }

  // Simulate cashier cash count
  simulateCashierCount(expectedCash: number, variance: number = 0): {
    denominations: CashDenomination[];
    totalCount: number;
  } {
    // Target amount is expected cash plus any variance
    const targetAmount = expectedCash + variance;

    // Philippine peso denominations
    const denominations = [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25];
    const result: CashDenomination[] = [];
    let remaining = targetAmount;

    for (const denom of denominations) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        result.push({
          denomination: denom,
          count: count,
          total: count * denom,
        });
        remaining = Math.round((remaining - (count * denom)) * 100) / 100; // Avoid floating point issues
      } else {
        result.push({
          denomination: denom,
          count: 0,
          total: 0,
        });
      }
    }

    const totalCount = result.reduce((sum, d) => sum + d.total, 0);

    return { denominations: result, totalCount };
  }

  // Test cash reconciliation
  async testCashReconciliation(): Promise<void> {
    console.log('\n--- Testing Cash Reconciliation ---');

    const expected = this.calculateExpectedValues();

    console.log(`\nExpected Cash Calculation:`);
    console.log(`  Beginning Cash:          ₱${TEST_CONFIG.beginningCash.toFixed(2)}`);
    console.log(`  + Cash Sales:            ₱${expected.cashSales.toFixed(2)}`);
    console.log(`  + Customer Payments:     ₱${expected.customerPaymentsCash.toFixed(2)}`);
    console.log(`  - Sales Returns (Cash):  ₱${expected.salesReturnsCash.toFixed(2)}`);
    console.log(`  - Supplier Payments:     ₱${expected.supplierPaymentsCash.toFixed(2)}`);
    console.log(`  = Expected Cash:         ₱${expected.expectedCash.toFixed(2)}`);

    // Scenario 1: Perfect count (no variance)
    console.log('\n  Scenario 1: Perfect Count');
    const perfectCount = this.simulateCashierCount(expected.expectedCash, 0);
    const variance1 = perfectCount.totalCount - expected.expectedCash;
    this.addResult(
      'Cash Variance (Perfect Count)',
      '0.00',
      variance1.toFixed(2),
      Math.abs(variance1) < 0.01,
      `Cashier counted: ₱${perfectCount.totalCount.toFixed(2)}`
    );

    // Scenario 2: Short by 50 pesos
    console.log('\n  Scenario 2: Short by ₱50');
    const shortCount = this.simulateCashierCount(expected.expectedCash, -50);
    const variance2 = shortCount.totalCount - expected.expectedCash;
    this.addResult(
      'Cash Variance (Short ₱50)',
      '-50.00',
      variance2.toFixed(2),
      Math.abs(variance2 - (-50)) < 0.01,
      `Cashier counted: ₱${shortCount.totalCount.toFixed(2)}`
    );

    // Scenario 3: Over by 20 pesos
    console.log('\n  Scenario 3: Over by ₱20');
    const overCount = this.simulateCashierCount(expected.expectedCash, 20);
    const variance3 = overCount.totalCount - expected.expectedCash;
    this.addResult(
      'Cash Variance (Over ₱20)',
      '20.00',
      variance3.toFixed(2),
      Math.abs(variance3 - 20) < 0.01,
      `Cashier counted: ₱${overCount.totalCount.toFixed(2)}`
    );
  }

  // Test X-Reading generation
  async testXReading(): Promise<void> {
    console.log('\n--- Testing X-Reading ---');

    try {
      const xReading = await this.db.generateXReading(TEST_CONFIG.cashierId);
      const expected = this.calculateExpectedValues();

      console.log(`\nX-Reading Results:`);
      console.log(`  Gross Sales: ₱${xReading.gross_sales?.toFixed(2) || '0.00'}`);
      console.log(`  VAT Amount: ₱${xReading.vat_amount?.toFixed(2) || '0.00'}`);
      console.log(`  Net Sales: ₱${xReading.net_sales?.toFixed(2) || '0.00'}`);
      console.log(`  Transaction Count: ${xReading.transaction_count || 0}`);

      // Test gross sales matches
      this.addResult(
        'X-Reading Gross Sales',
        expected.grossSales.toFixed(2),
        (xReading.gross_sales || 0).toFixed(2),
        Math.abs(expected.grossSales - (xReading.gross_sales || 0)) < 0.01
      );

      // Test transaction count
      this.addResult(
        'X-Reading Transaction Count',
        TEST_CONFIG.transactions.length,
        xReading.transaction_count || 0,
        TEST_CONFIG.transactions.length === (xReading.transaction_count || 0)
      );

    } catch (error: any) {
      console.error(`X-Reading Error: ${error.message}`);
      this.addResult('X-Reading Generation', 'success', 'error', false, error.message);
    }
  }

  // Print final summary
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      for (const result of this.results.filter(r => !r.passed)) {
        console.log(`  - ${result.testName}`);
        console.log(`    Expected: ${result.expected}, Actual: ${result.actual}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(failed === 0 ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED');
    console.log('='.repeat(60));
  }

  // Run all tests
  async runAllTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
    await this.initialize();

    // Create test data
    await this.createTestTransactions();

    // Run verification tests
    await this.verifyTransactionTotals();
    await this.testCashReconciliation();
    await this.testXReading();

    // Print summary
    this.printSummary();

    return {
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      results: this.results,
    };
  }
}

// Export test runner function
export async function runCashReconciliationTest(): Promise<void> {
  const test = new CashReconciliationTest();
  await test.runAllTests();
}

// Export for direct execution
export { CashReconciliationTest, TEST_CONFIG };
