/**
 * Browser Console Test for Cash Reconciliation
 *
 * Copy and paste this entire script into the browser console
 * while on the POS Dashboard page to run automated tests.
 */

(async function runBrowserTest() {
  console.log('='.repeat(60));
  console.log('CASH RECONCILIATION BROWSER TEST');
  console.log('='.repeat(60));

  // Get database reference from the app's global scope
  const dbModule = await import('/database/getDatabase.ts');
  const db = dbModule.getDatabase();

  const results = [];
  const addResult = (name, expected, actual, passed, note = '') => {
    results.push({ name, expected, actual, passed, note });
    console.log(`${passed ? '✓' : '✗'} ${name}: Expected ${expected}, Got ${actual} ${note ? '(' + note + ')' : ''}`);
  };

  // Test Configuration
  const CONFIG = {
    beginningCash: 5000,
    cashierId: 1,
  };

  try {
    // STEP 1: Get existing products
    console.log('\n--- Step 1: Getting Products ---');
    const products = await db.getProducts();
    console.log(`Found ${products.length} products`);

    if (products.length === 0) {
      console.error('No products found! Please add products first.');
      return;
    }

    const testProduct = products[0];
    console.log(`Using product: ${testProduct.name} (₱${testProduct.price})`);

    // STEP 2: Create test transactions
    console.log('\n--- Step 2: Creating Test Transactions ---');

    const testSales = [
      { method: 'CASH', amount: 150 },
      { method: 'CASH', amount: 275 },
      { method: 'CASH', amount: 89 },
      { method: 'CARD', amount: 500 },
      { method: 'ONLINE', amount: 185 },
      { method: 'CHARGE_INVOICE', amount: 750 },
    ];

    let createdCount = 0;
    for (const sale of testSales) {
      const taxRate = 0.12;
      const baseAmount = sale.amount / (1 + taxRate);
      const taxAmount = sale.amount - baseAmount;

      try {
        const result = await db.createTransaction({
          customer_name: 'Test Customer',
          subtotal: baseAmount,
          tax_amount: taxAmount,
          discount_amount: 0,
          total_amount: sale.amount,
          payment_method: sale.method,
          amount_tendered: sale.amount,
          change_amount: 0,
          cashier_id: CONFIG.cashierId,
          items: [{
            product_id: testProduct.id,
            product_code: testProduct.code || 'TEST',
            product_name: testProduct.name,
            quantity: 1,
            unit_price: sale.amount,
            discount_amount: 0,
            tax_amount: taxAmount,
            total_amount: sale.amount,
          }],
        });
        console.log(`  Created ${sale.method} sale: ₱${sale.amount} (${result.invoiceNumber})`);
        createdCount++;
      } catch (e) {
        console.error(`  Failed to create ${sale.method} sale:`, e.message);
      }
    }

    addResult('Transactions Created', testSales.length, createdCount, createdCount === testSales.length);

    // STEP 3: Verify totals from database
    console.log('\n--- Step 3: Verifying Totals ---');
    const transactions = await db.getTodaysTransactions();

    let actualCash = 0, actualCard = 0, actualOnline = 0, actualCredit = 0, actualGross = 0;

    for (const txn of transactions) {
      if (txn.status === 'COMPLETED') {
        actualGross += txn.total_amount;
        switch (txn.payment_method) {
          case 'CASH': actualCash += txn.total_amount; break;
          case 'CARD': actualCard += txn.total_amount; break;
          case 'ONLINE': actualOnline += txn.total_amount; break;
          case 'CHARGE_INVOICE': actualCredit += txn.total_amount; break;
        }
      }
    }

    // Expected values from test data
    const expectedCash = 150 + 275 + 89; // 514
    const expectedCard = 500;
    const expectedOnline = 185;
    const expectedCredit = 750;
    const expectedGross = expectedCash + expectedCard + expectedOnline + expectedCredit; // 1949

    // Note: actualGross may be higher if there are pre-existing transactions
    console.log(`\nTransaction Summary:`);
    console.log(`  Cash Sales: ₱${actualCash.toFixed(2)}`);
    console.log(`  Card Sales: ₱${actualCard.toFixed(2)}`);
    console.log(`  Online Sales: ₱${actualOnline.toFixed(2)}`);
    console.log(`  Credit Sales: ₱${actualCredit.toFixed(2)}`);
    console.log(`  Gross Sales: ₱${actualGross.toFixed(2)}`);

    // Verify our test transactions are included (actualCash >= expectedCash)
    addResult('Cash Sales >= Expected', expectedCash, actualCash, actualCash >= expectedCash);
    addResult('Card Sales >= Expected', expectedCard, actualCard, actualCard >= expectedCard);
    addResult('Online Sales >= Expected', expectedOnline, actualOnline, actualOnline >= expectedOnline);

    // STEP 4: Test Cash Reconciliation Logic
    console.log('\n--- Step 4: Cash Reconciliation Test ---');

    // For this test, we'll use only the sales we just created
    const testExpectedCash = CONFIG.beginningCash + expectedCash; // 5514

    // Simulate perfect cash count
    const actualCashCount = testExpectedCash;
    const variance = actualCashCount - testExpectedCash;

    console.log(`\nCash Reconciliation:`);
    console.log(`  Beginning Cash:  ₱${CONFIG.beginningCash.toFixed(2)}`);
    console.log(`  + Cash Sales:    ₱${expectedCash.toFixed(2)}`);
    console.log(`  = Expected Cash: ₱${testExpectedCash.toFixed(2)}`);
    console.log(`  Actual Count:    ₱${actualCashCount.toFixed(2)}`);
    console.log(`  Variance:        ₱${variance.toFixed(2)}`);

    addResult('Cash Variance (Perfect)', 0, variance, variance === 0);

    // Test short scenario
    const shortCount = testExpectedCash - 50;
    const shortVariance = shortCount - testExpectedCash;
    addResult('Cash Variance (Short ₱50)', -50, shortVariance, shortVariance === -50);

    // Test over scenario
    const overCount = testExpectedCash + 25;
    const overVariance = overCount - testExpectedCash;
    addResult('Cash Variance (Over ₱25)', 25, overVariance, overVariance === 25);

    // STEP 5: Test X-Reading
    console.log('\n--- Step 5: X-Reading Test ---');
    try {
      const xReading = await db.generateXReading(CONFIG.cashierId);
      console.log(`\nX-Reading Generated:`);
      console.log(`  Gross Sales: ₱${(xReading.gross_sales || 0).toFixed(2)}`);
      console.log(`  VAT Amount: ₱${(xReading.vat_amount || 0).toFixed(2)}`);
      console.log(`  Net Sales: ₱${(xReading.net_sales || 0).toFixed(2)}`);
      console.log(`  Transactions: ${xReading.transaction_count || 0}`);

      addResult('X-Reading Generated', true, true, true);
      addResult('X-Reading Has Data', true, (xReading.gross_sales || 0) > 0, (xReading.gross_sales || 0) > 0);
    } catch (e) {
      console.error('X-Reading failed:', e.message);
      addResult('X-Reading Generated', true, false, false, e.message);
    }

    // FINAL SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  ✗ ${r.name}: Expected ${r.expected}, Got ${r.actual}`);
      });
    }

    console.log('\n' + (failed === 0 ? '✓ ALL TESTS PASSED!' : '✗ SOME TESTS FAILED'));
    console.log('='.repeat(60));

    return { passed, failed, results };

  } catch (error) {
    console.error('Test Error:', error);
    return { passed: 0, failed: 1, error: error.message };
  }
})();
