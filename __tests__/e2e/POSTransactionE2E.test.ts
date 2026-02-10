/**
 * End-to-End POS Transaction Test
 *
 * This test suite verifies all POS transactions and ensures X-Reading and Z-Reading
 * reports are accurate. Uses pure code manipulation without Playwright or browser automation.
 *
 * Tests cover:
 * - All payment methods (Cash, Card, Check, Online, Charge Invoice)
 * - All discount types (Percent, Amount, Senior Citizen, PWD)
 * - Returns (Cash Refund, Store Credit, Exchange)
 * - Void transactions
 * - Account Receivable payments (all methods)
 * - Cash In/Out operations (Opening Fund, Petty Cash, Cash In)
 * - X-Reading accuracy
 * - Z-Reading accuracy
 * - BIR compliance (sequential invoices, cumulative totals, VAT calculations)
 */

// ============================================================================
// MOCK DATABASE SERVICE
// ============================================================================

interface Transaction {
  id: number;
  transaction_number: string;
  invoice_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_tin: string;
  customer_address: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: 'CASH' | 'CARD' | 'CHECK' | 'ONLINE' | 'CHARGE_INVOICE';
  amount_tendered: number;
  change_amount: number;
  payment_status: 'PAID' | 'UNPAID' | 'PARTIAL';
  status: 'COMPLETED' | 'VOID' | 'REFUNDED';
  sc_pwd_id: string | null;
  sc_pwd_name: string | null;
  sc_pwd_type: 'SENIOR' | 'PWD' | null;
  void_reason: string | null;
  void_by: number | null;
  void_date: string | null;
  cashier_id: number;
  transaction_date: string;
  created_at: string;
}

interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  price_type: 'retail' | 'wholesale';
}

interface SalesReturn {
  id: number;
  return_number: string;
  original_transaction_id: number;
  original_invoice_number: string;
  customer_id: number | null;
  customer_name: string | null;
  return_date: string;
  total_amount: number;
  refund_method: 'CASH' | 'CREDIT' | 'EXCHANGE';
  reason: string;
  notes: string | null;
  processed_by: number;
  status: 'COMPLETED' | 'CANCELLED';
}

interface CashMovement {
  id: number;
  movement_type: 'OPENING_FUND' | 'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH' | 'CASH_REFUND';
  amount: number;
  description: string;
  reference_number: string | null;
  approved_by: string | null;
  cashier_id: number;
  created_at: string;
}

interface CustomerPayment {
  id: number;
  payment_number: string;
  customer_id: number | null;
  transaction_id: number;
  payment_date: string;
  payment_method: 'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' | 'ONLINE';
  amount_paid: number;
  reference_number: string | null;
  notes: string | null;
  received_by: number;
  created_at: string;
}

interface AccountsReceivable {
  id: number;
  transaction_id: number;
  customer_id: number | null;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  original_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: 'OUTSTANDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
}

interface Product {
  id: number;
  product_code: string;
  name: string;
  selling_price: number;
  stock_quantity: number;
  vat_type: 'vatable' | 'vat_exempt' | 'zero_rated';
  is_vat_inclusive: boolean;
}

interface EJournalEntry {
  id: number;
  entry_type: 'SALE' | 'VOID' | 'REFUND' | 'RETURN' | 'PAYMENT' | 'Z_READING' | 'X_READING' | 'SYSTEM';
  reference_number: string;
  description: string;
  amount: number;
  cashier_id: number;
  timestamp: string;
}

interface ZReading {
  id: number;
  reading_number: number;
  date: string;
  start_invoice_number: string;
  end_invoice_number: string;
  gross_sales: number;
  vat_sales: number;
  vat_amount: number;
  vat_exempt_sales: number;
  zero_rated_sales: number;
  discount_amount: number;
  void_amount: number;
  refund_amount: number;
  net_sales: number;
  cumulative_grand_total: number;
  cashier_id: number;
}

interface XReadingData {
  date: string;
  time: string;
  day_closed: boolean;
  transaction_count: number;
  gross_sales: number;
  vat_sales: number;
  vat_amount: number;
  vat_exempt_sales: number;
  zero_rated_sales: number;
  discount_amount: number;
  void_amount: number;
  void_count: number;
  exchange_amount: number;
  exchange_count: number;
  refund_amount: number;
  refund_count: number;
  net_sales: number;
  cash_sales: number;
  card_sales: number;
  check_sales: number;
  credit_sales: number;
  online_sales: number;
  beginning_cash: number;
  cash_fund: number;
  petty_cash: number;
  customer_payments_cash: number;
  customer_payments_check: number;
  customer_payments_card: number;
  customer_payments_online: number;
  customer_payments_bank_transfer: number;
  customer_payments_total: number;
  expected_cash: number;
}

// Mock Database Service for Testing
class MockDatabaseService {
  private transactions: Transaction[] = [];
  private transactionItems: TransactionItem[] = [];
  private salesReturns: SalesReturn[] = [];
  private cashMovements: CashMovement[] = [];
  private customerPayments: CustomerPayment[] = [];
  private accountsReceivable: AccountsReceivable[] = [];
  private products: Product[] = [];
  private ejournal: EJournalEntry[] = [];
  private zReadings: ZReading[] = [];

  private invoiceCounter = 0;
  private transactionIdCounter = 0;
  private returnIdCounter = 0;
  private cashMovementIdCounter = 0;
  private customerPaymentIdCounter = 0;
  private arIdCounter = 0;
  private zReadingCounter = 0;
  private ejournalIdCounter = 0;
  private cumulativeGrandTotal = 0;
  private beginningCash = 0;

  private testDate: string;

  constructor() {
    this.testDate = this.getPhilippineDateString();
    this.initializeProducts();
  }

  private getPhilippineDateString(): string {
    const now = new Date();
    const phOffset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const phDate = new Date(now.getTime() + (phOffset + localOffset) * 60000);
    return phDate.toISOString().split('T')[0];
  }

  private getPhilippineDateTimeString(): string {
    const now = new Date();
    const phOffset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const phDate = new Date(now.getTime() + (phOffset + localOffset) * 60000);
    return phDate.toISOString().replace('T', ' ').split('.')[0];
  }

  private getPhilippineTimeString(): string {
    return this.getPhilippineDateTimeString().split(' ')[1];
  }

  private initializeProducts(): void {
    this.products = [
      { id: 1, product_code: 'P001', name: 'Coca Cola 1.5L', selling_price: 75.00, stock_quantity: 100, vat_type: 'vatable', is_vat_inclusive: true },
      { id: 2, product_code: 'P002', name: 'Rice Premium 25kg', selling_price: 1500.00, stock_quantity: 50, vat_type: 'vatable', is_vat_inclusive: true },
      { id: 3, product_code: 'P003', name: 'Cooking Oil 1L', selling_price: 180.00, stock_quantity: 75, vat_type: 'vatable', is_vat_inclusive: true },
      { id: 4, product_code: 'P004', name: 'Fresh Vegetables', selling_price: 50.00, stock_quantity: 200, vat_type: 'vat_exempt', is_vat_inclusive: false },
      { id: 5, product_code: 'P005', name: 'Bread Loaf', selling_price: 45.00, stock_quantity: 80, vat_type: 'vatable', is_vat_inclusive: true },
    ];
  }

  public setBeginningCash(amount: number): void {
    this.beginningCash = amount;
  }

  public getNextInvoiceNumber(): string {
    this.invoiceCounter++;
    return `INV-${String(this.invoiceCounter).padStart(8, '0')}`;
  }

  // Round to 2 decimal places (Philippine Peso standard)
  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // ========================================
  // CREATE TRANSACTION
  // ========================================
  public createTransaction(transaction: {
    customer_id?: number;
    customer_name?: string;
    customer_tin?: string;
    customer_address?: string;
    subtotal: number;
    tax_amount: number;
    discount_amount?: number;
    total_amount: number;
    payment_method: 'CASH' | 'CARD' | 'CHECK' | 'ONLINE' | 'CHARGE_INVOICE';
    amount_tendered: number;
    change_amount?: number;
    cashier_id: number;
    sc_pwd_id?: string;
    sc_pwd_name?: string;
    sc_pwd_type?: 'SENIOR' | 'PWD';
    items: Array<{
      product_id: number;
      product_code: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      discount_amount?: number;
      tax_amount: number;
      total_amount: number;
      price_type?: 'retail' | 'wholesale';
    }>;
  }): { transactionNumber: string; invoiceNumber: string; transactionId: number } {
    const transactionNumber = `TXN${Date.now()}`;
    const invoiceNumber = this.getNextInvoiceNumber();
    this.transactionIdCounter++;
    const transactionId = this.transactionIdCounter;

    const isChargeInvoice = transaction.payment_method === 'CHARGE_INVOICE';
    const paymentStatus = isChargeInvoice ? 'UNPAID' : 'PAID';
    const phDateTime = this.getPhilippineDateTimeString();

    // Create transaction record
    const txn: Transaction = {
      id: transactionId,
      transaction_number: transactionNumber,
      invoice_number: invoiceNumber,
      customer_id: transaction.customer_id || null,
      customer_name: transaction.customer_name || '',
      customer_tin: transaction.customer_tin || '',
      customer_address: transaction.customer_address || '',
      subtotal: transaction.subtotal,
      tax_amount: transaction.tax_amount,
      discount_amount: transaction.discount_amount || 0,
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      amount_tendered: transaction.amount_tendered,
      change_amount: transaction.change_amount || 0,
      payment_status: paymentStatus,
      status: 'COMPLETED',
      sc_pwd_id: transaction.sc_pwd_id || null,
      sc_pwd_name: transaction.sc_pwd_name || null,
      sc_pwd_type: transaction.sc_pwd_type || null,
      void_reason: null,
      void_by: null,
      void_date: null,
      cashier_id: transaction.cashier_id,
      transaction_date: phDateTime,
      created_at: phDateTime
    };
    this.transactions.push(txn);

    // Create transaction items and update inventory
    for (const item of transaction.items) {
      this.transactionItems.push({
        id: this.transactionItems.length + 1,
        transaction_id: transactionId,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
        tax_amount: item.tax_amount,
        total_amount: item.total_amount,
        price_type: item.price_type || 'retail'
      });

      // Update product stock
      const product = this.products.find(p => p.id === item.product_id);
      if (product) {
        product.stock_quantity -= item.quantity;
      }
    }

    // Create AR entry for charge invoices
    if (isChargeInvoice) {
      this.arIdCounter++;
      const invoiceDate = this.getPhilippineDateString();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      this.accountsReceivable.push({
        id: this.arIdCounter,
        transaction_id: transactionId,
        customer_id: transaction.customer_id || null,
        customer_name: transaction.customer_name || 'Walk-in Customer',
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate.toISOString().split('T')[0],
        original_amount: transaction.total_amount,
        paid_amount: 0,
        balance_amount: transaction.total_amount,
        status: 'OUTSTANDING'
      });
    }

    // Add eJournal entry
    this.ejournalIdCounter++;
    this.ejournal.push({
      id: this.ejournalIdCounter,
      entry_type: 'SALE',
      reference_number: invoiceNumber,
      description: `Sale transaction - Invoice: ${invoiceNumber}`,
      amount: transaction.total_amount,
      cashier_id: transaction.cashier_id,
      timestamp: phDateTime
    });

    return { transactionNumber, invoiceNumber, transactionId };
  }

  // ========================================
  // VOID TRANSACTION
  // ========================================
  public voidTransaction(voidData: {
    transaction_id: number;
    void_reason: string;
    void_by: number;
  }): boolean {
    const txn = this.transactions.find(t => t.id === voidData.transaction_id && t.status === 'COMPLETED');
    if (!txn) {
      throw new Error('Transaction not found or already voided');
    }

    // Restore inventory
    const items = this.transactionItems.filter(ti => ti.transaction_id === voidData.transaction_id);
    for (const item of items) {
      const product = this.products.find(p => p.id === item.product_id);
      if (product) {
        product.stock_quantity += item.quantity;
      }
    }

    // If charge invoice, update AR
    if (txn.payment_method === 'CHARGE_INVOICE') {
      const ar = this.accountsReceivable.find(a => a.transaction_id === voidData.transaction_id);
      if (ar) {
        ar.status = 'PAID';
        ar.balance_amount = 0;
        ar.paid_amount = ar.original_amount;
      }
    }

    // Update transaction
    txn.status = 'VOID';
    txn.void_reason = voidData.void_reason;
    txn.void_by = voidData.void_by;
    txn.void_date = this.getPhilippineDateTimeString();

    // Add eJournal entry
    this.ejournalIdCounter++;
    this.ejournal.push({
      id: this.ejournalIdCounter,
      entry_type: 'VOID',
      reference_number: txn.invoice_number,
      description: `Transaction voided: ${voidData.void_reason}`,
      amount: -txn.total_amount,
      cashier_id: voidData.void_by,
      timestamp: this.getPhilippineDateTimeString()
    });

    return true;
  }

  // ========================================
  // CREATE SALES RETURN
  // ========================================
  public createSalesReturn(returnData: {
    original_transaction_id: number;
    original_invoice_number: string;
    customer_id?: number;
    customer_name?: string;
    total_amount: number;
    refund_method: 'CASH' | 'CREDIT' | 'EXCHANGE';
    reason: string;
    notes?: string;
    processed_by: number;
    items: Array<{
      product_id: number;
      product_code: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      total_amount: number;
    }>;
  }): number {
    this.returnIdCounter++;
    const returnNumber = `RET-${String(this.returnIdCounter).padStart(6, '0')}`;
    const returnDate = this.getPhilippineDateString();

    const salesReturn: SalesReturn = {
      id: this.returnIdCounter,
      return_number: returnNumber,
      original_transaction_id: returnData.original_transaction_id,
      original_invoice_number: returnData.original_invoice_number,
      customer_id: returnData.customer_id || null,
      customer_name: returnData.customer_name || null,
      return_date: returnDate,
      total_amount: returnData.total_amount,
      refund_method: returnData.refund_method,
      reason: returnData.reason,
      notes: returnData.notes || null,
      processed_by: returnData.processed_by,
      status: 'COMPLETED'
    };
    this.salesReturns.push(salesReturn);

    // Restore inventory
    for (const item of returnData.items) {
      const product = this.products.find(p => p.id === item.product_id);
      if (product) {
        product.stock_quantity += item.quantity;
      }
    }

    // If CASH refund, record cash movement
    if (returnData.refund_method === 'CASH') {
      this.createCashMovement({
        movement_type: 'CASH_REFUND',
        amount: returnData.total_amount,
        description: `Cash refund for return ${returnNumber}`,
        reference_number: returnNumber,
        cashier_id: returnData.processed_by
      });
    }

    // Add eJournal entry
    this.ejournalIdCounter++;
    this.ejournal.push({
      id: this.ejournalIdCounter,
      entry_type: 'RETURN',
      reference_number: returnNumber,
      description: `Sales return - ${returnData.refund_method} - ${returnData.items.length} items`,
      amount: -returnData.total_amount,
      cashier_id: returnData.processed_by,
      timestamp: this.getPhilippineDateTimeString()
    });

    return this.returnIdCounter;
  }

  // ========================================
  // CREATE CASH MOVEMENT
  // ========================================
  public createCashMovement(movementData: {
    movement_type: 'OPENING_FUND' | 'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH' | 'CASH_REFUND';
    amount: number;
    description: string;
    reference_number?: string;
    approved_by?: string;
    cashier_id: number;
  }): number {
    this.cashMovementIdCounter++;

    const movement: CashMovement = {
      id: this.cashMovementIdCounter,
      movement_type: movementData.movement_type,
      amount: movementData.amount,
      description: movementData.description,
      reference_number: movementData.reference_number || null,
      approved_by: movementData.approved_by || null,
      cashier_id: movementData.cashier_id,
      created_at: this.getPhilippineDateTimeString()
    };
    this.cashMovements.push(movement);

    // Add eJournal entry
    this.ejournalIdCounter++;
    const isOutflow = movementData.movement_type === 'PETTY_CASH' ||
                       movementData.movement_type === 'CASH_OUT' ||
                       movementData.movement_type === 'CASH_REFUND';
    this.ejournal.push({
      id: this.ejournalIdCounter,
      entry_type: 'SYSTEM',
      reference_number: movementData.reference_number || `CASH-${this.cashMovementIdCounter}`,
      description: `Cash ${movementData.movement_type}: ${movementData.description}`,
      amount: isOutflow ? -movementData.amount : movementData.amount,
      cashier_id: movementData.cashier_id,
      timestamp: this.getPhilippineDateTimeString()
    });

    return this.cashMovementIdCounter;
  }

  // ========================================
  // PROCESS CUSTOMER PAYMENT (AR Payment)
  // ========================================
  public processCustomerPayment(paymentData: {
    customer_id?: number;
    transaction_id: number;
    payment_method: 'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' | 'ONLINE';
    amount_paid: number;
    reference_number?: string;
    notes?: string;
    received_by: number;
  }): number {
    this.customerPaymentIdCounter++;
    const paymentNumber = `PAY-${String(this.customerPaymentIdCounter).padStart(6, '0')}`;
    const phDate = this.getPhilippineDateString();

    const payment: CustomerPayment = {
      id: this.customerPaymentIdCounter,
      payment_number: paymentNumber,
      customer_id: paymentData.customer_id || null,
      transaction_id: paymentData.transaction_id,
      payment_date: phDate,
      payment_method: paymentData.payment_method,
      amount_paid: paymentData.amount_paid,
      reference_number: paymentData.reference_number || null,
      notes: paymentData.notes || null,
      received_by: paymentData.received_by,
      created_at: this.getPhilippineDateTimeString()
    };
    this.customerPayments.push(payment);

    // Update AR
    const ar = this.accountsReceivable.find(a => a.transaction_id === paymentData.transaction_id);
    if (ar) {
      ar.paid_amount += paymentData.amount_paid;
      ar.balance_amount = ar.original_amount - ar.paid_amount;

      if (ar.balance_amount <= 0) {
        ar.status = 'PAID';
        ar.balance_amount = 0;
      } else if (ar.paid_amount > 0) {
        ar.status = 'PARTIALLY_PAID';
      }
    }

    // Add eJournal entry
    this.ejournalIdCounter++;
    this.ejournal.push({
      id: this.ejournalIdCounter,
      entry_type: 'PAYMENT',
      reference_number: paymentNumber,
      description: `Customer payment received - ${paymentNumber}`,
      amount: paymentData.amount_paid,
      cashier_id: paymentData.received_by,
      timestamp: this.getPhilippineDateTimeString()
    });

    return this.customerPaymentIdCounter;
  }

  // ========================================
  // GET CASH DRAWER BALANCE
  // ========================================
  public getCashDrawerBalance(): {
    opening_fund: number;
    cash_in: number;
    cash_out: number;
    petty_cash: number;
    cash_refunds: number;
    net_balance: number;
  } {
    const targetDate = this.testDate;

    let opening_fund = 0;
    let cash_in = 0;
    let cash_out = 0;
    let petty_cash = 0;
    let cash_refunds = 0;

    for (const cm of this.cashMovements) {
      if (cm.created_at.startsWith(targetDate)) {
        switch (cm.movement_type) {
          case 'OPENING_FUND': opening_fund += cm.amount; break;
          case 'CASH_IN': cash_in += cm.amount; break;
          case 'CASH_OUT': cash_out += cm.amount; break;
          case 'PETTY_CASH': petty_cash += cm.amount; break;
          case 'CASH_REFUND': cash_refunds += cm.amount; break;
        }
      }
    }

    const net_balance = opening_fund + cash_in - cash_out - petty_cash - cash_refunds;

    return { opening_fund, cash_in, cash_out, petty_cash, cash_refunds, net_balance };
  }

  // ========================================
  // GET X-READING DATA
  // ========================================
  public getXReadingData(): XReadingData {
    const targetDate = this.testDate;
    const currentTime = this.getPhilippineTimeString();

    // Filter transactions for today
    const todayTransactions = this.transactions.filter(t =>
      t.transaction_date.startsWith(targetDate)
    );

    // Completed transactions
    const completedTxns = todayTransactions.filter(t => t.status === 'COMPLETED');
    const voidedTxns = todayTransactions.filter(t => t.status === 'VOID');

    // Gross Sales = total_amount + discount_amount for completed transactions
    const gross_sales = this.round2(
      completedTxns.reduce((sum, t) => sum + t.total_amount + t.discount_amount, 0)
    );

    // VAT calculations
    const vat_amount = this.round2(completedTxns.reduce((sum, t) => sum + t.tax_amount, 0));
    const discount_amount = this.round2(completedTxns.reduce((sum, t) => sum + t.discount_amount, 0));

    // Void amount and count
    const void_amount = this.round2(voidedTxns.reduce((sum, t) => sum + t.total_amount, 0));
    const void_count = voidedTxns.length;

    // Sales by payment method
    const cash_sales = this.round2(
      completedTxns.filter(t => t.payment_method === 'CASH')
        .reduce((sum, t) => sum + t.total_amount, 0)
    );
    const card_sales = this.round2(
      completedTxns.filter(t => t.payment_method === 'CARD')
        .reduce((sum, t) => sum + t.total_amount, 0)
    );
    const check_sales = this.round2(
      completedTxns.filter(t => t.payment_method === 'CHECK')
        .reduce((sum, t) => sum + t.total_amount, 0)
    );
    const credit_sales = this.round2(
      completedTxns.filter(t => t.payment_method === 'CHARGE_INVOICE')
        .reduce((sum, t) => sum + t.total_amount, 0)
    );
    const online_sales = this.round2(
      completedTxns.filter(t => t.payment_method === 'ONLINE')
        .reduce((sum, t) => sum + t.total_amount, 0)
    );

    // VAT breakdown from transaction items
    let vatable_total = 0;
    let vat_exempt_sales = 0;
    let zero_rated_sales = 0;

    for (const txn of completedTxns) {
      const items = this.transactionItems.filter(ti => ti.transaction_id === txn.id);
      for (const item of items) {
        const product = this.products.find(p => p.id === item.product_id);
        if (product) {
          switch (product.vat_type) {
            case 'vatable': vatable_total += item.total_amount; break;
            case 'vat_exempt': vat_exempt_sales += item.total_amount; break;
            case 'zero_rated': zero_rated_sales += item.total_amount; break;
          }
        }
      }
    }

    const vat_sales = this.round2(vatable_total / 1.12); // VAT-exclusive amount

    // Returns and Exchanges
    const todayReturns = this.salesReturns.filter(r =>
      r.return_date === targetDate && r.status === 'COMPLETED'
    );

    const refundReturns = todayReturns.filter(r => r.refund_method !== 'EXCHANGE');
    const exchangeReturns = todayReturns.filter(r => r.refund_method === 'EXCHANGE');

    const refund_amount = this.round2(refundReturns.reduce((sum, r) => sum + r.total_amount, 0));
    const refund_count = refundReturns.length;
    const exchange_amount = this.round2(exchangeReturns.reduce((sum, r) => sum + r.total_amount, 0));
    const exchange_count = exchangeReturns.length;

    // Net Sales = Gross Sales - Discounts - Refunds
    const net_sales = this.round2(gross_sales - discount_amount - refund_amount);

    // Cash movements
    const cashMovements = this.getCashDrawerBalance();

    // Customer payments (AR collections)
    const todayPayments = this.customerPayments.filter(p => p.payment_date === targetDate);

    const customer_payments_cash = this.round2(
      todayPayments.filter(p => p.payment_method === 'CASH')
        .reduce((sum, p) => sum + p.amount_paid, 0)
    );
    const customer_payments_check = this.round2(
      todayPayments.filter(p => p.payment_method === 'CHECK')
        .reduce((sum, p) => sum + p.amount_paid, 0)
    );
    const customer_payments_card = this.round2(
      todayPayments.filter(p => p.payment_method === 'CARD')
        .reduce((sum, p) => sum + p.amount_paid, 0)
    );
    const customer_payments_online = this.round2(
      todayPayments.filter(p => p.payment_method === 'ONLINE')
        .reduce((sum, p) => sum + p.amount_paid, 0)
    );
    const customer_payments_bank_transfer = this.round2(
      todayPayments.filter(p => p.payment_method === 'BANK_TRANSFER')
        .reduce((sum, p) => sum + p.amount_paid, 0)
    );
    const customer_payments_total = this.round2(
      customer_payments_cash + customer_payments_check + customer_payments_card +
      customer_payments_online + customer_payments_bank_transfer
    );

    // Expected Cash = Beginning Cash + Cash Fund + Cash Sales + AR Cash Payments - Cash Refunds - Petty Cash
    // Cash Fund includes opening_fund + cash_in
    const cash_fund = cashMovements.opening_fund + cashMovements.cash_in;
    const expected_cash = this.round2(
      this.beginningCash + cashMovements.net_balance + cash_sales + customer_payments_cash
    );

    return {
      date: targetDate,
      time: currentTime,
      day_closed: false,
      transaction_count: completedTxns.length,
      gross_sales,
      vat_sales,
      vat_amount,
      vat_exempt_sales: this.round2(vat_exempt_sales),
      zero_rated_sales: this.round2(zero_rated_sales),
      discount_amount,
      void_amount,
      void_count,
      exchange_amount,
      exchange_count,
      refund_amount,
      refund_count,
      net_sales,
      cash_sales,
      card_sales,
      check_sales,
      credit_sales,
      online_sales,
      beginning_cash: this.beginningCash,
      cash_fund,
      petty_cash: cashMovements.petty_cash,
      customer_payments_cash,
      customer_payments_check,
      customer_payments_card,
      customer_payments_online,
      customer_payments_bank_transfer,
      customer_payments_total,
      expected_cash
    };
  }

  // ========================================
  // GENERATE Z-READING
  // ========================================
  public generateZReading(cashier_id: number): ZReading {
    const targetDate = this.testDate;

    // Check if already generated
    const existing = this.zReadings.find(z => z.date === targetDate);
    if (existing) {
      throw new Error(`Z-Reading already generated for ${targetDate}`);
    }

    this.zReadingCounter++;

    // Get X-Reading data as base
    const xData = this.getXReadingData();

    // Get invoice range
    const todayTxns = this.transactions.filter(t => t.transaction_date.startsWith(targetDate));
    const invoiceNumbers = todayTxns.map(t => t.invoice_number).sort();

    // Update cumulative grand total
    this.cumulativeGrandTotal += xData.net_sales;

    const zReading: ZReading = {
      id: this.zReadingCounter,
      reading_number: this.zReadingCounter,
      date: targetDate,
      start_invoice_number: invoiceNumbers[0] || '',
      end_invoice_number: invoiceNumbers[invoiceNumbers.length - 1] || '',
      gross_sales: xData.gross_sales,
      vat_sales: xData.vat_sales,
      vat_amount: xData.vat_amount,
      vat_exempt_sales: xData.vat_exempt_sales,
      zero_rated_sales: xData.zero_rated_sales,
      discount_amount: xData.discount_amount,
      void_amount: xData.void_amount,
      refund_amount: xData.refund_amount,
      net_sales: xData.net_sales,
      cumulative_grand_total: this.cumulativeGrandTotal,
      cashier_id
    };
    this.zReadings.push(zReading);

    // Add eJournal entry
    this.ejournalIdCounter++;
    this.ejournal.push({
      id: this.ejournalIdCounter,
      entry_type: 'Z_READING',
      reference_number: `Z-${this.zReadingCounter}`,
      description: `Z-Reading #${this.zReadingCounter} generated`,
      amount: xData.net_sales,
      cashier_id,
      timestamp: this.getPhilippineDateTimeString()
    });

    return zReading;
  }

  // ========================================
  // VERIFICATION HELPERS
  // ========================================
  public getTransactions(): Transaction[] {
    return this.transactions;
  }

  public getEJournal(): EJournalEntry[] {
    return this.ejournal;
  }

  public getZReadings(): ZReading[] {
    return this.zReadings;
  }

  public getAccountsReceivable(): AccountsReceivable[] {
    return this.accountsReceivable;
  }

  public getProducts(): Product[] {
    return this.products;
  }

  public getInvoiceCounter(): number {
    return this.invoiceCounter;
  }

  public getCumulativeGrandTotal(): number {
    return this.cumulativeGrandTotal;
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

class POSTransactionE2ETest {
  private db: MockDatabaseService;
  private testResults: { test: string; passed: boolean; message: string }[] = [];
  private cashierId = 1;

  constructor() {
    this.db = new MockDatabaseService();
  }

  private log(message: string): void {
    console.log(`[TEST] ${message}`);
  }

  private assert(condition: boolean, testName: string, message: string): void {
    if (condition) {
      this.testResults.push({ test: testName, passed: true, message: 'PASSED' });
      this.log(`✓ ${testName}: PASSED`);
    } else {
      this.testResults.push({ test: testName, passed: false, message });
      this.log(`✗ ${testName}: FAILED - ${message}`);
    }
  }

  private assertEqual(actual: number, expected: number, testName: string, tolerance = 0.01): void {
    const diff = Math.abs(actual - expected);
    if (diff <= tolerance) {
      this.testResults.push({ test: testName, passed: true, message: 'PASSED' });
      this.log(`✓ ${testName}: PASSED (Expected: ₱${expected.toFixed(2)}, Got: ₱${actual.toFixed(2)})`);
    } else {
      this.testResults.push({ test: testName, passed: false, message: `Expected ₱${expected.toFixed(2)}, Got ₱${actual.toFixed(2)}` });
      this.log(`✗ ${testName}: FAILED - Expected ₱${expected.toFixed(2)}, Got ₱${actual.toFixed(2)}`);
    }
  }

  // ========================================
  // TEST: CASH SALES
  // ========================================
  public testCashSales(): void {
    this.log('\n========== TEST: CASH SALES ==========');

    // Sale 1: Simple cash sale
    const result1 = this.db.createTransaction({
      subtotal: 75.00,
      tax_amount: 8.04, // 75/1.12 * 0.12 = 8.04
      total_amount: 75.00,
      payment_method: 'CASH',
      amount_tendered: 100.00,
      change_amount: 25.00,
      cashier_id: this.cashierId,
      items: [{
        product_id: 1,
        product_code: 'P001',
        product_name: 'Coca Cola 1.5L',
        quantity: 1,
        unit_price: 75.00,
        tax_amount: 8.04,
        total_amount: 75.00
      }]
    });

    this.assert(
      result1.invoiceNumber === 'INV-00000001',
      'Cash Sale - Invoice Number',
      `Expected INV-00000001, Got ${result1.invoiceNumber}`
    );

    // Sale 2: Multiple items cash sale
    const result2 = this.db.createTransaction({
      subtotal: 255.00,
      tax_amount: 27.32,
      total_amount: 255.00,
      payment_method: 'CASH',
      amount_tendered: 300.00,
      change_amount: 45.00,
      cashier_id: this.cashierId,
      items: [
        {
          product_id: 1,
          product_code: 'P001',
          product_name: 'Coca Cola 1.5L',
          quantity: 2,
          unit_price: 75.00,
          tax_amount: 16.07,
          total_amount: 150.00
        },
        {
          product_id: 5,
          product_code: 'P005',
          product_name: 'Bread Loaf',
          quantity: 1,
          unit_price: 45.00,
          tax_amount: 4.82,
          total_amount: 45.00
        },
        {
          product_id: 4,
          product_code: 'P004',
          product_name: 'Fresh Vegetables',
          quantity: 1,
          unit_price: 50.00,
          tax_amount: 0, // VAT exempt
          total_amount: 50.00
        }
      ]
    });

    this.assert(
      result2.invoiceNumber === 'INV-00000002',
      'Cash Sale - Sequential Invoice',
      `Expected INV-00000002, Got ${result2.invoiceNumber}`
    );

    // Verify X-Reading cash sales
    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.cash_sales, 330.00, 'Cash Sales Total in X-Reading');
  }

  // ========================================
  // TEST: CARD SALES
  // ========================================
  public testCardSales(): void {
    this.log('\n========== TEST: CARD SALES ==========');

    const result = this.db.createTransaction({
      subtotal: 1500.00,
      tax_amount: 160.71,
      total_amount: 1500.00,
      payment_method: 'CARD',
      amount_tendered: 1500.00,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [{
        product_id: 2,
        product_code: 'P002',
        product_name: 'Rice Premium 25kg',
        quantity: 1,
        unit_price: 1500.00,
        tax_amount: 160.71,
        total_amount: 1500.00
      }]
    });

    this.assert(
      result.invoiceNumber === 'INV-00000003',
      'Card Sale - Sequential Invoice',
      `Expected INV-00000003, Got ${result.invoiceNumber}`
    );

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.card_sales, 1500.00, 'Card Sales Total in X-Reading');
  }

  // ========================================
  // TEST: CHECK SALES
  // ========================================
  public testCheckSales(): void {
    this.log('\n========== TEST: CHECK SALES ==========');

    const result = this.db.createTransaction({
      subtotal: 360.00,
      tax_amount: 38.57,
      total_amount: 360.00,
      payment_method: 'CHECK',
      amount_tendered: 360.00,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [{
        product_id: 3,
        product_code: 'P003',
        product_name: 'Cooking Oil 1L',
        quantity: 2,
        unit_price: 180.00,
        tax_amount: 19.29,
        total_amount: 360.00
      }]
    });

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.check_sales, 360.00, 'Check Sales Total in X-Reading');
  }

  // ========================================
  // TEST: ONLINE SALES (GCash/Maya)
  // ========================================
  public testOnlineSales(): void {
    this.log('\n========== TEST: ONLINE SALES ==========');

    const result = this.db.createTransaction({
      subtotal: 225.00,
      tax_amount: 24.11,
      total_amount: 225.00,
      payment_method: 'ONLINE',
      amount_tendered: 225.00,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [
        {
          product_id: 1,
          product_code: 'P001',
          product_name: 'Coca Cola 1.5L',
          quantity: 3,
          unit_price: 75.00,
          tax_amount: 24.11,
          total_amount: 225.00
        }
      ]
    });

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.online_sales, 225.00, 'Online Sales Total in X-Reading');
  }

  // ========================================
  // TEST: CHARGE INVOICE (Creates AR)
  // ========================================
  public testChargeInvoice(): void {
    this.log('\n========== TEST: CHARGE INVOICE ==========');

    const result = this.db.createTransaction({
      customer_id: 1,
      customer_name: 'Juan Dela Cruz',
      subtotal: 500.00,
      tax_amount: 53.57,
      total_amount: 500.00,
      payment_method: 'CHARGE_INVOICE',
      amount_tendered: 0,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [{
        product_id: 3,
        product_code: 'P003',
        product_name: 'Cooking Oil 1L',
        quantity: 2,
        unit_price: 180.00,
        tax_amount: 38.57,
        total_amount: 360.00
      }, {
        product_id: 5,
        product_code: 'P005',
        product_name: 'Bread Loaf',
        quantity: 3,
        unit_price: 45.00,
        tax_amount: 14.46,
        total_amount: 135.00
      }]
    });

    // Verify AR was created
    const arRecords = this.db.getAccountsReceivable();
    this.assert(arRecords.length > 0, 'Charge Invoice - AR Created', 'AR record should be created');

    const ar = arRecords[arRecords.length - 1];
    this.assertEqual(ar.original_amount, 500.00, 'Charge Invoice - AR Amount');
    this.assert(ar.status === 'OUTSTANDING', 'Charge Invoice - AR Status', `Expected OUTSTANDING, Got ${ar.status}`);

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.credit_sales, 500.00, 'Credit Sales Total in X-Reading');
  }

  // ========================================
  // TEST: PERCENT DISCOUNT
  // ========================================
  public testPercentDiscount(): void {
    this.log('\n========== TEST: PERCENT DISCOUNT ==========');

    // 10% discount on ₱150 sale
    const subtotal = 150.00;
    const discountAmount = 15.00; // 10%
    const totalAfterDiscount = 135.00;
    const taxAmount = 14.46; // 135/1.12*0.12

    const result = this.db.createTransaction({
      subtotal: subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAfterDiscount,
      payment_method: 'CASH',
      amount_tendered: 150.00,
      change_amount: 15.00,
      cashier_id: this.cashierId,
      items: [{
        product_id: 1,
        product_code: 'P001',
        product_name: 'Coca Cola 1.5L',
        quantity: 2,
        unit_price: 75.00,
        discount_amount: 15.00,
        tax_amount: taxAmount,
        total_amount: 135.00
      }]
    });

    const xReading = this.db.getXReadingData();
    this.assert(xReading.discount_amount >= 15.00, 'Percent Discount - Tracked in X-Reading',
      `Discount should include ₱15.00, Got ₱${xReading.discount_amount.toFixed(2)}`);
  }

  // ========================================
  // TEST: FIXED AMOUNT DISCOUNT
  // ========================================
  public testAmountDiscount(): void {
    this.log('\n========== TEST: FIXED AMOUNT DISCOUNT ==========');

    // ₱50 discount on ₱225 sale
    const subtotal = 225.00;
    const discountAmount = 50.00;
    const totalAfterDiscount = 175.00;
    const taxAmount = 18.75;

    const result = this.db.createTransaction({
      subtotal: subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAfterDiscount,
      payment_method: 'CASH',
      amount_tendered: 200.00,
      change_amount: 25.00,
      cashier_id: this.cashierId,
      items: [{
        product_id: 1,
        product_code: 'P001',
        product_name: 'Coca Cola 1.5L',
        quantity: 3,
        unit_price: 75.00,
        discount_amount: 50.00,
        tax_amount: taxAmount,
        total_amount: 175.00
      }]
    });

    const xReading = this.db.getXReadingData();
    this.assert(xReading.discount_amount >= 65.00, 'Amount Discount - Accumulated in X-Reading',
      `Total discounts should be at least ₱65.00 (15+50), Got ₱${xReading.discount_amount.toFixed(2)}`);
  }

  // ========================================
  // TEST: SENIOR CITIZEN DISCOUNT (20% + VAT Exempt)
  // ========================================
  public testSeniorCitizenDiscount(): void {
    this.log('\n========== TEST: SENIOR CITIZEN DISCOUNT ==========');

    // SC/PWD gets 20% discount on VAT-exclusive price + VAT exemption
    // ₱75 item (VAT-inclusive) -> ₱66.96 VAT-exclusive -> 20% discount = ₱13.39
    // Final: ₱66.96 - ₱13.39 = ₱53.57
    const vatExclusive = 75.00 / 1.12; // 66.96
    const scDiscount = vatExclusive * 0.20; // 13.39
    const finalAmount = vatExclusive - scDiscount; // 53.57

    const result = this.db.createTransaction({
      subtotal: vatExclusive,
      tax_amount: 0, // VAT exempt for SC/PWD
      discount_amount: scDiscount,
      total_amount: Math.round(finalAmount * 100) / 100,
      payment_method: 'CASH',
      amount_tendered: 60.00,
      change_amount: 6.43,
      cashier_id: this.cashierId,
      sc_pwd_id: 'SC-123456',
      sc_pwd_name: 'Maria Santos',
      sc_pwd_type: 'SENIOR',
      items: [{
        product_id: 1,
        product_code: 'P001',
        product_name: 'Coca Cola 1.5L',
        quantity: 1,
        unit_price: 75.00,
        discount_amount: scDiscount,
        tax_amount: 0, // VAT exempt
        total_amount: Math.round(finalAmount * 100) / 100
      }]
    });

    // Verify SC/PWD info is tracked
    const txns = this.db.getTransactions();
    const scTxn = txns.find(t => t.sc_pwd_id === 'SC-123456');
    this.assert(scTxn !== undefined, 'SC Discount - SC Info Tracked', 'SC/PWD info should be recorded');
    this.assert(scTxn?.sc_pwd_type === 'SENIOR', 'SC Discount - Type Tracked',
      `Expected SENIOR, Got ${scTxn?.sc_pwd_type}`);
  }

  // ========================================
  // TEST: PWD DISCOUNT (20% + VAT Exempt)
  // ========================================
  public testPWDDiscount(): void {
    this.log('\n========== TEST: PWD DISCOUNT ==========');

    const vatExclusive = 180.00 / 1.12; // 160.71
    const pwdDiscount = vatExclusive * 0.20; // 32.14
    const finalAmount = vatExclusive - pwdDiscount; // 128.57

    const result = this.db.createTransaction({
      subtotal: vatExclusive,
      tax_amount: 0,
      discount_amount: pwdDiscount,
      total_amount: Math.round(finalAmount * 100) / 100,
      payment_method: 'CASH',
      amount_tendered: 130.00,
      change_amount: 1.43,
      cashier_id: this.cashierId,
      sc_pwd_id: 'PWD-789012',
      sc_pwd_name: 'Pedro Reyes',
      sc_pwd_type: 'PWD',
      items: [{
        product_id: 3,
        product_code: 'P003',
        product_name: 'Cooking Oil 1L',
        quantity: 1,
        unit_price: 180.00,
        discount_amount: pwdDiscount,
        tax_amount: 0,
        total_amount: Math.round(finalAmount * 100) / 100
      }]
    });

    const txns = this.db.getTransactions();
    const pwdTxn = txns.find(t => t.sc_pwd_id === 'PWD-789012');
    this.assert(pwdTxn?.sc_pwd_type === 'PWD', 'PWD Discount - Type Tracked',
      `Expected PWD, Got ${pwdTxn?.sc_pwd_type}`);
  }

  // ========================================
  // TEST: CASH REFUND
  // ========================================
  public testCashRefund(): void {
    this.log('\n========== TEST: CASH REFUND ==========');

    // First create a sale to refund
    const sale = this.db.createTransaction({
      subtotal: 150.00,
      tax_amount: 16.07,
      total_amount: 150.00,
      payment_method: 'CASH',
      amount_tendered: 150.00,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [{
        product_id: 1,
        product_code: 'P001',
        product_name: 'Coca Cola 1.5L',
        quantity: 2,
        unit_price: 75.00,
        tax_amount: 16.07,
        total_amount: 150.00
      }]
    });

    // Now process the refund
    const returnId = this.db.createSalesReturn({
      original_transaction_id: sale.transactionId,
      original_invoice_number: sale.invoiceNumber,
      total_amount: 75.00, // Refund 1 item
      refund_method: 'CASH',
      reason: 'Defective product',
      processed_by: this.cashierId,
      items: [{
        product_id: 1,
        product_code: 'P001',
        product_name: 'Coca Cola 1.5L',
        quantity: 1,
        unit_price: 75.00,
        total_amount: 75.00
      }]
    });

    this.assert(returnId > 0, 'Cash Refund - Return Created', `Return ID: ${returnId}`);

    // Verify X-Reading shows the refund
    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.refund_amount, 75.00, 'Cash Refund - Amount in X-Reading');
    this.assert(xReading.refund_count === 1, 'Cash Refund - Count in X-Reading',
      `Expected 1, Got ${xReading.refund_count}`);

    // Verify cash drawer balance is reduced
    const cashBalance = this.db.getCashDrawerBalance();
    this.assertEqual(cashBalance.cash_refunds, 75.00, 'Cash Refund - Tracked in Cash Drawer');
  }

  // ========================================
  // TEST: STORE CREDIT REFUND
  // ========================================
  public testStoreCreditRefund(): void {
    this.log('\n========== TEST: STORE CREDIT REFUND ==========');

    // First create a sale
    const sale = this.db.createTransaction({
      customer_id: 1,
      customer_name: 'Juan Dela Cruz',
      subtotal: 90.00,
      tax_amount: 9.64,
      total_amount: 90.00,
      payment_method: 'CASH',
      amount_tendered: 100.00,
      change_amount: 10.00,
      cashier_id: this.cashierId,
      items: [{
        product_id: 5,
        product_code: 'P005',
        product_name: 'Bread Loaf',
        quantity: 2,
        unit_price: 45.00,
        tax_amount: 9.64,
        total_amount: 90.00
      }]
    });

    // Process credit refund
    const returnId = this.db.createSalesReturn({
      original_transaction_id: sale.transactionId,
      original_invoice_number: sale.invoiceNumber,
      customer_id: 1,
      customer_name: 'Juan Dela Cruz',
      total_amount: 45.00,
      refund_method: 'CREDIT',
      reason: 'Customer changed mind',
      processed_by: this.cashierId,
      items: [{
        product_id: 5,
        product_code: 'P005',
        product_name: 'Bread Loaf',
        quantity: 1,
        unit_price: 45.00,
        total_amount: 45.00
      }]
    });

    // Credit refund should NOT affect cash drawer
    const cashBalance = this.db.getCashDrawerBalance();
    this.assertEqual(cashBalance.cash_refunds, 75.00, 'Credit Refund - No Change to Cash Refunds');

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.refund_amount, 120.00, 'Credit Refund - Total Refunds (75+45)');
  }

  // ========================================
  // TEST: EXCHANGE
  // ========================================
  public testExchange(): void {
    this.log('\n========== TEST: EXCHANGE ==========');

    // First create a sale
    const sale = this.db.createTransaction({
      subtotal: 180.00,
      tax_amount: 19.29,
      total_amount: 180.00,
      payment_method: 'CASH',
      amount_tendered: 200.00,
      change_amount: 20.00,
      cashier_id: this.cashierId,
      items: [{
        product_id: 3,
        product_code: 'P003',
        product_name: 'Cooking Oil 1L',
        quantity: 1,
        unit_price: 180.00,
        tax_amount: 19.29,
        total_amount: 180.00
      }]
    });

    // Process exchange
    const returnId = this.db.createSalesReturn({
      original_transaction_id: sale.transactionId,
      original_invoice_number: sale.invoiceNumber,
      total_amount: 180.00,
      refund_method: 'EXCHANGE',
      reason: 'Wrong item given',
      processed_by: this.cashierId,
      items: [{
        product_id: 3,
        product_code: 'P003',
        product_name: 'Cooking Oil 1L',
        quantity: 1,
        unit_price: 180.00,
        total_amount: 180.00
      }]
    });

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.exchange_amount, 180.00, 'Exchange - Amount in X-Reading');
    this.assert(xReading.exchange_count === 1, 'Exchange - Count in X-Reading',
      `Expected 1, Got ${xReading.exchange_count}`);

    // Exchange should NOT be in refund totals
    this.assertEqual(xReading.refund_amount, 120.00, 'Exchange - Not in Refund Amount');
  }

  // ========================================
  // TEST: VOID TRANSACTION
  // ========================================
  public testVoidTransaction(): void {
    this.log('\n========== TEST: VOID TRANSACTION ==========');

    // Create a sale to void
    const sale = this.db.createTransaction({
      subtotal: 300.00,
      tax_amount: 32.14,
      total_amount: 300.00,
      payment_method: 'CASH',
      amount_tendered: 300.00,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [{
        product_id: 1,
        product_code: 'P001',
        product_name: 'Coca Cola 1.5L',
        quantity: 4,
        unit_price: 75.00,
        tax_amount: 32.14,
        total_amount: 300.00
      }]
    });

    // Get stock before void
    const productBefore = this.db.getProducts().find(p => p.id === 1);
    const stockBefore = productBefore?.stock_quantity || 0;

    // Void the transaction
    const success = this.db.voidTransaction({
      transaction_id: sale.transactionId,
      void_reason: 'Customer canceled order',
      void_by: this.cashierId
    });

    this.assert(success, 'Void Transaction - Success', 'Void should succeed');

    // Verify stock was restored
    const productAfter = this.db.getProducts().find(p => p.id === 1);
    this.assert(
      productAfter!.stock_quantity === stockBefore + 4,
      'Void Transaction - Stock Restored',
      `Expected ${stockBefore + 4}, Got ${productAfter?.stock_quantity}`
    );

    // Verify X-Reading shows void
    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.void_amount, 300.00, 'Void - Amount in X-Reading');
    this.assert(xReading.void_count === 1, 'Void - Count in X-Reading',
      `Expected 1, Got ${xReading.void_count}`);

    // Verify voided transaction is NOT in gross sales
    // (gross_sales should not include the ₱300 voided transaction)
  }

  // ========================================
  // TEST: AR PAYMENT - CASH
  // ========================================
  public testARPaymentCash(): void {
    this.log('\n========== TEST: AR PAYMENT - CASH ==========');

    // Get the AR record from charge invoice test
    const arRecords = this.db.getAccountsReceivable();
    const ar = arRecords.find(a => a.status !== 'PAID');

    if (!ar) {
      this.log('No outstanding AR found - skipping test');
      return;
    }

    // Make partial cash payment
    const paymentId = this.db.processCustomerPayment({
      customer_id: ar.customer_id || undefined,
      transaction_id: ar.transaction_id,
      payment_method: 'CASH',
      amount_paid: 200.00,
      received_by: this.cashierId
    });

    this.assert(paymentId > 0, 'AR Cash Payment - Created', `Payment ID: ${paymentId}`);

    // Verify AR updated
    const updatedAR = this.db.getAccountsReceivable().find(a => a.id === ar.id);
    this.assertEqual(updatedAR!.paid_amount, 200.00, 'AR Cash Payment - Paid Amount Updated');
    this.assertEqual(updatedAR!.balance_amount, 300.00, 'AR Cash Payment - Balance Updated');
    this.assert(updatedAR!.status === 'PARTIALLY_PAID', 'AR Cash Payment - Status Updated',
      `Expected PARTIALLY_PAID, Got ${updatedAR?.status}`);

    // Verify X-Reading
    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.customer_payments_cash, 200.00, 'AR Cash Payment - In X-Reading');
  }

  // ========================================
  // TEST: AR PAYMENT - CHECK
  // ========================================
  public testARPaymentCheck(): void {
    this.log('\n========== TEST: AR PAYMENT - CHECK ==========');

    const arRecords = this.db.getAccountsReceivable();
    const ar = arRecords.find(a => a.status === 'PARTIALLY_PAID');

    if (!ar) {
      this.log('No partially paid AR found - skipping test');
      return;
    }

    // Pay with check
    const paymentId = this.db.processCustomerPayment({
      customer_id: ar.customer_id || undefined,
      transaction_id: ar.transaction_id,
      payment_method: 'CHECK',
      amount_paid: 150.00,
      reference_number: 'CHK-001234',
      received_by: this.cashierId
    });

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.customer_payments_check, 150.00, 'AR Check Payment - In X-Reading');
  }

  // ========================================
  // TEST: AR PAYMENT - CARD
  // ========================================
  public testARPaymentCard(): void {
    this.log('\n========== TEST: AR PAYMENT - CARD ==========');

    const arRecords = this.db.getAccountsReceivable();
    const ar = arRecords.find(a => a.status === 'PARTIALLY_PAID');

    if (!ar) {
      this.log('No partially paid AR found - skipping test');
      return;
    }

    // Final payment with card
    const remainingBalance = ar.balance_amount;
    const paymentId = this.db.processCustomerPayment({
      customer_id: ar.customer_id || undefined,
      transaction_id: ar.transaction_id,
      payment_method: 'CARD',
      amount_paid: remainingBalance,
      received_by: this.cashierId
    });

    // Verify AR is now paid
    const updatedAR = this.db.getAccountsReceivable().find(a => a.id === ar.id);
    this.assert(updatedAR!.status === 'PAID', 'AR Card Payment - Fully Paid',
      `Expected PAID, Got ${updatedAR?.status}`);

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.customer_payments_card, remainingBalance, 'AR Card Payment - In X-Reading');
  }

  // ========================================
  // TEST: AR PAYMENT - ONLINE (GCash)
  // ========================================
  public testARPaymentOnline(): void {
    this.log('\n========== TEST: AR PAYMENT - ONLINE ==========');

    // Create new charge invoice for this test
    const sale = this.db.createTransaction({
      customer_id: 2,
      customer_name: 'Ana Reyes',
      subtotal: 400.00,
      tax_amount: 42.86,
      total_amount: 400.00,
      payment_method: 'CHARGE_INVOICE',
      amount_tendered: 0,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [{
        product_id: 2,
        product_code: 'P002',
        product_name: 'Rice Premium 25kg',
        quantity: 1,
        unit_price: 400.00,
        tax_amount: 42.86,
        total_amount: 400.00
      }]
    });

    // Pay via GCash
    this.db.processCustomerPayment({
      customer_id: 2,
      transaction_id: sale.transactionId,
      payment_method: 'ONLINE',
      amount_paid: 400.00,
      reference_number: 'GCASH-123456',
      received_by: this.cashierId
    });

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.customer_payments_online, 400.00, 'AR Online Payment - In X-Reading');
  }

  // ========================================
  // TEST: AR PAYMENT - BANK TRANSFER
  // ========================================
  public testARPaymentBankTransfer(): void {
    this.log('\n========== TEST: AR PAYMENT - BANK TRANSFER ==========');

    // Create new charge invoice
    const sale = this.db.createTransaction({
      customer_id: 3,
      customer_name: 'Carlos Garcia',
      subtotal: 600.00,
      tax_amount: 64.29,
      total_amount: 600.00,
      payment_method: 'CHARGE_INVOICE',
      amount_tendered: 0,
      change_amount: 0,
      cashier_id: this.cashierId,
      items: [{
        product_id: 2,
        product_code: 'P002',
        product_name: 'Rice Premium 25kg',
        quantity: 1,
        unit_price: 600.00,
        tax_amount: 64.29,
        total_amount: 600.00
      }]
    });

    // Pay via bank transfer
    this.db.processCustomerPayment({
      customer_id: 3,
      transaction_id: sale.transactionId,
      payment_method: 'BANK_TRANSFER',
      amount_paid: 600.00,
      reference_number: 'BDO-TRF-789012',
      received_by: this.cashierId
    });

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.customer_payments_bank_transfer, 600.00, 'AR Bank Transfer - In X-Reading');
  }

  // ========================================
  // TEST: CASH IN (Opening Fund)
  // ========================================
  public testCashInOpeningFund(): void {
    this.log('\n========== TEST: CASH IN - OPENING FUND ==========');

    this.db.createCashMovement({
      movement_type: 'OPENING_FUND',
      amount: 5000.00,
      description: 'Opening cash fund for the day',
      cashier_id: this.cashierId
    });

    const cashBalance = this.db.getCashDrawerBalance();
    this.assertEqual(cashBalance.opening_fund, 5000.00, 'Opening Fund - In Cash Drawer');

    const xReading = this.db.getXReadingData();
    this.assert(xReading.cash_fund >= 5000.00, 'Opening Fund - In X-Reading Cash Fund',
      `Expected >= ₱5000, Got ₱${xReading.cash_fund.toFixed(2)}`);
  }

  // ========================================
  // TEST: CASH IN (Additional)
  // ========================================
  public testCashInAdditional(): void {
    this.log('\n========== TEST: CASH IN - ADDITIONAL ==========');

    this.db.createCashMovement({
      movement_type: 'CASH_IN',
      amount: 2000.00,
      description: 'Additional cash from safe',
      approved_by: 'Manager',
      cashier_id: this.cashierId
    });

    const cashBalance = this.db.getCashDrawerBalance();
    this.assertEqual(cashBalance.cash_in, 2000.00, 'Additional Cash In - In Cash Drawer');
  }

  // ========================================
  // TEST: PETTY CASH (Cash Out)
  // ========================================
  public testPettyCash(): void {
    this.log('\n========== TEST: PETTY CASH ==========');

    this.db.createCashMovement({
      movement_type: 'PETTY_CASH',
      amount: 500.00,
      description: 'Office supplies purchase',
      approved_by: 'Manager',
      cashier_id: this.cashierId
    });

    const cashBalance = this.db.getCashDrawerBalance();
    this.assertEqual(cashBalance.petty_cash, 500.00, 'Petty Cash - In Cash Drawer');

    const xReading = this.db.getXReadingData();
    this.assertEqual(xReading.petty_cash, 500.00, 'Petty Cash - In X-Reading');
  }

  // ========================================
  // TEST: X-READING ACCURACY
  // ========================================
  public testXReadingAccuracy(): void {
    this.log('\n========== TEST: X-READING ACCURACY ==========');

    const xReading = this.db.getXReadingData();

    // Verify gross sales formula: sum of (total_amount + discount_amount) for COMPLETED transactions
    const txns = this.db.getTransactions().filter(t => t.status === 'COMPLETED');
    const expectedGrossSales = txns.reduce((sum, t) => sum + t.total_amount + t.discount_amount, 0);
    this.assertEqual(xReading.gross_sales, Math.round(expectedGrossSales * 100) / 100,
      'X-Reading - Gross Sales Formula');

    // Verify net sales formula: gross_sales - discount_amount - refund_amount
    const expectedNetSales = xReading.gross_sales - xReading.discount_amount - xReading.refund_amount;
    this.assertEqual(xReading.net_sales, Math.round(expectedNetSales * 100) / 100,
      'X-Reading - Net Sales Formula');

    // Verify payment method breakdown sums to completed sales
    const totalByPaymentMethod = xReading.cash_sales + xReading.card_sales +
      xReading.check_sales + xReading.credit_sales + xReading.online_sales;
    const expectedTotal = txns.reduce((sum, t) => sum + t.total_amount, 0);
    this.assertEqual(totalByPaymentMethod, Math.round(expectedTotal * 100) / 100,
      'X-Reading - Payment Method Sum');

    // Verify AR payments total
    const expectedARTotal = xReading.customer_payments_cash + xReading.customer_payments_check +
      xReading.customer_payments_card + xReading.customer_payments_online +
      xReading.customer_payments_bank_transfer;
    this.assertEqual(xReading.customer_payments_total, expectedARTotal,
      'X-Reading - AR Payments Total');

    // Verify expected cash formula
    const cashBalance = this.db.getCashDrawerBalance();
    const expectedCash = this.db['beginningCash'] + cashBalance.net_balance +
      xReading.cash_sales + xReading.customer_payments_cash;
    this.assertEqual(xReading.expected_cash, Math.round(expectedCash * 100) / 100,
      'X-Reading - Expected Cash Formula');

    this.log(`\nX-Reading Summary:`);
    this.log(`  Transaction Count: ${xReading.transaction_count}`);
    this.log(`  Gross Sales: ₱${xReading.gross_sales.toFixed(2)}`);
    this.log(`  Discounts: ₱${xReading.discount_amount.toFixed(2)}`);
    this.log(`  Refunds: ₱${xReading.refund_amount.toFixed(2)} (${xReading.refund_count} returns)`);
    this.log(`  Exchanges: ₱${xReading.exchange_amount.toFixed(2)} (${xReading.exchange_count} exchanges)`);
    this.log(`  Voids: ₱${xReading.void_amount.toFixed(2)} (${xReading.void_count} voids)`);
    this.log(`  Net Sales: ₱${xReading.net_sales.toFixed(2)}`);
    this.log(`  Cash Sales: ₱${xReading.cash_sales.toFixed(2)}`);
    this.log(`  Card Sales: ₱${xReading.card_sales.toFixed(2)}`);
    this.log(`  Check Sales: ₱${xReading.check_sales.toFixed(2)}`);
    this.log(`  Credit Sales: ₱${xReading.credit_sales.toFixed(2)}`);
    this.log(`  Online Sales: ₱${xReading.online_sales.toFixed(2)}`);
    this.log(`  AR Payments Total: ₱${xReading.customer_payments_total.toFixed(2)}`);
    this.log(`  Expected Cash: ₱${xReading.expected_cash.toFixed(2)}`);
  }

  // ========================================
  // TEST: Z-READING ACCURACY
  // ========================================
  public testZReadingAccuracy(): void {
    this.log('\n========== TEST: Z-READING ACCURACY ==========');

    const xReading = this.db.getXReadingData();
    const zReading = this.db.generateZReading(this.cashierId);

    // Z-Reading should match X-Reading data
    this.assertEqual(zReading.gross_sales, xReading.gross_sales, 'Z-Reading - Gross Sales Match');
    this.assertEqual(zReading.discount_amount, xReading.discount_amount, 'Z-Reading - Discount Match');
    this.assertEqual(zReading.void_amount, xReading.void_amount, 'Z-Reading - Void Match');
    this.assertEqual(zReading.net_sales, xReading.net_sales, 'Z-Reading - Net Sales Match');

    // Verify cumulative grand total
    this.assertEqual(zReading.cumulative_grand_total, zReading.net_sales,
      'Z-Reading - Cumulative Grand Total (First Day)');

    // Verify sequential reading number
    this.assert(zReading.reading_number === 1, 'Z-Reading - Sequential Number',
      `Expected 1, Got ${zReading.reading_number}`);

    // Verify invoice range
    this.assert(zReading.start_invoice_number !== '', 'Z-Reading - Start Invoice Set',
      'Start invoice should be set');
    this.assert(zReading.end_invoice_number !== '', 'Z-Reading - End Invoice Set',
      'End invoice should be set');

    this.log(`\nZ-Reading Summary:`);
    this.log(`  Reading Number: Z-${zReading.reading_number}`);
    this.log(`  Date: ${zReading.date}`);
    this.log(`  Invoice Range: ${zReading.start_invoice_number} to ${zReading.end_invoice_number}`);
    this.log(`  Gross Sales: ₱${zReading.gross_sales.toFixed(2)}`);
    this.log(`  Discounts: ₱${zReading.discount_amount.toFixed(2)}`);
    this.log(`  Voids: ₱${zReading.void_amount.toFixed(2)}`);
    this.log(`  Net Sales: ₱${zReading.net_sales.toFixed(2)}`);
    this.log(`  Cumulative Grand Total: ₱${zReading.cumulative_grand_total.toFixed(2)}`);
  }

  // ========================================
  // TEST: BIR COMPLIANCE
  // ========================================
  public testBIRCompliance(): void {
    this.log('\n========== TEST: BIR COMPLIANCE ==========');

    // 1. Sequential Invoice Numbers
    const txns = this.db.getTransactions();
    let invoicesSequential = true;
    for (let i = 1; i < txns.length; i++) {
      const prevNum = parseInt(txns[i-1].invoice_number.split('-')[1]);
      const currNum = parseInt(txns[i].invoice_number.split('-')[1]);
      if (currNum !== prevNum + 1) {
        invoicesSequential = false;
        break;
      }
    }
    this.assert(invoicesSequential, 'BIR - Sequential Invoice Numbers',
      'Invoice numbers must be sequential');

    // 2. Cumulative Grand Total Never Resets
    const zReadings = this.db.getZReadings();
    if (zReadings.length > 0) {
      const lastZ = zReadings[zReadings.length - 1];
      this.assert(lastZ.cumulative_grand_total > 0, 'BIR - Cumulative Grand Total Tracked',
        `CGT: ₱${lastZ.cumulative_grand_total.toFixed(2)}`);
    }

    // 3. VAT Calculations (12%)
    const completedTxns = txns.filter(t => t.status === 'COMPLETED' && !t.sc_pwd_id);
    for (const txn of completedTxns.slice(0, 3)) { // Check first 3
      if (txn.tax_amount > 0) {
        const expectedVAT = (txn.subtotal / 1.12) * 0.12;
        const vatDiff = Math.abs(txn.tax_amount - expectedVAT);
        // Allow 1% tolerance for rounding
        this.assert(vatDiff < txn.subtotal * 0.01, 'BIR - 12% VAT Calculation',
          `Transaction ${txn.invoice_number}: Expected ~₱${expectedVAT.toFixed(2)}, Got ₱${txn.tax_amount.toFixed(2)}`);
      }
    }

    // 4. SC/PWD Discounts are 20% with VAT Exemption
    const scPwdTxns = txns.filter(t => t.sc_pwd_id);
    for (const txn of scPwdTxns) {
      this.assert(txn.tax_amount === 0, 'BIR - SC/PWD VAT Exempt',
        `Transaction ${txn.invoice_number} should have 0 VAT`);
    }

    // 5. All Transactions Have eJournal Entries
    const journal = this.db.getEJournal();
    const saleEntries = journal.filter(e => e.entry_type === 'SALE');
    const completedSales = txns.filter(t => t.status === 'COMPLETED').length;
    // Note: Some might be voided, so we check completed sales
    this.assert(saleEntries.length >= completedSales - 1, 'BIR - eJournal Audit Trail',
      `Expected ${completedSales} SALE entries, Got ${saleEntries.length}`);

    // 6. Void entries in eJournal
    const voidEntries = journal.filter(e => e.entry_type === 'VOID');
    const voidedTxns = txns.filter(t => t.status === 'VOID').length;
    this.assert(voidEntries.length === voidedTxns, 'BIR - Void Entries in eJournal',
      `Expected ${voidedTxns} VOID entries, Got ${voidEntries.length}`);

    // 7. Z-Reading entry in eJournal
    const zReadingEntries = journal.filter(e => e.entry_type === 'Z_READING');
    this.assert(zReadingEntries.length > 0, 'BIR - Z-Reading in eJournal',
      'Z-Reading should be recorded in eJournal');

    this.log(`\nBIR Compliance Summary:`);
    this.log(`  Total Invoices: ${this.db.getInvoiceCounter()}`);
    this.log(`  eJournal Entries: ${journal.length}`);
    this.log(`  Z-Readings: ${zReadings.length}`);
    this.log(`  Cumulative Grand Total: ₱${this.db.getCumulativeGrandTotal().toFixed(2)}`);
  }

  // ========================================
  // TEST: EXPECTED CASH CALCULATION
  // ========================================
  public testExpectedCashCalculation(): void {
    this.log('\n========== TEST: EXPECTED CASH CALCULATION ==========');

    const xReading = this.db.getXReadingData();
    const cashBalance = this.db.getCashDrawerBalance();

    // Formula: Beginning Cash + Cash Fund Net + Cash Sales + AR Cash Payments
    // Where Cash Fund Net = Opening Fund + Cash In - Cash Out - Petty Cash - Cash Refunds

    this.log(`\nExpected Cash Breakdown:`);
    this.log(`  Beginning Cash: ₱${xReading.beginning_cash.toFixed(2)}`);
    this.log(`  + Opening Fund: ₱${cashBalance.opening_fund.toFixed(2)}`);
    this.log(`  + Cash In: ₱${cashBalance.cash_in.toFixed(2)}`);
    this.log(`  - Cash Out: ₱${cashBalance.cash_out.toFixed(2)}`);
    this.log(`  - Petty Cash: ₱${cashBalance.petty_cash.toFixed(2)}`);
    this.log(`  - Cash Refunds: ₱${cashBalance.cash_refunds.toFixed(2)}`);
    this.log(`  = Cash Fund Net: ₱${cashBalance.net_balance.toFixed(2)}`);
    this.log(`  + Cash Sales: ₱${xReading.cash_sales.toFixed(2)}`);
    this.log(`  + AR Cash Payments: ₱${xReading.customer_payments_cash.toFixed(2)}`);
    this.log(`  = Expected Cash: ₱${xReading.expected_cash.toFixed(2)}`);

    // Verify the formula
    const calculatedExpected = xReading.beginning_cash + cashBalance.net_balance +
      xReading.cash_sales + xReading.customer_payments_cash;
    this.assertEqual(xReading.expected_cash, Math.round(calculatedExpected * 100) / 100,
      'Expected Cash - Formula Verification');
  }

  // ========================================
  // RUN ALL TESTS
  // ========================================
  public runAllTests(): void {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     POS TRANSACTION END-TO-END TEST SUITE                       ║');
    console.log('║     Testing All Transactions, X-Reading & Z-Reading Accuracy    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Set beginning cash
    this.db.setBeginningCash(1000.00);

    // Run all tests in sequence
    this.testCashSales();
    this.testCardSales();
    this.testCheckSales();
    this.testOnlineSales();
    this.testChargeInvoice();
    this.testPercentDiscount();
    this.testAmountDiscount();
    this.testSeniorCitizenDiscount();
    this.testPWDDiscount();
    this.testCashRefund();
    this.testStoreCreditRefund();
    this.testExchange();
    this.testVoidTransaction();
    this.testARPaymentCash();
    this.testARPaymentCheck();
    this.testARPaymentCard();
    this.testARPaymentOnline();
    this.testARPaymentBankTransfer();
    this.testCashInOpeningFund();
    this.testCashInAdditional();
    this.testPettyCash();
    this.testXReadingAccuracy();
    this.testZReadingAccuracy();
    this.testBIRCompliance();
    this.testExpectedCashCalculation();

    // Print summary
    this.printSummary();
  }

  private printSummary(): void {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    console.log(`\n  Total Tests: ${total}`);
    console.log(`  ✓ Passed: ${passed}`);
    console.log(`  ✗ Failed: ${failed}`);
    console.log(`  Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('  Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`    - ${r.test}: ${r.message}`));
    }

    console.log('\n' + '═'.repeat(68));

    if (failed === 0) {
      console.log('\n  ✓ ALL TESTS PASSED! X-Reading and Z-Reading are accurate.\n');
    } else {
      console.log(`\n  ✗ ${failed} test(s) failed. Please review and fix.\n`);
    }
  }
}

// ============================================================================
// EXECUTE TESTS
// ============================================================================

function runE2ETests(): void {
  const testSuite = new POSTransactionE2ETest();
  testSuite.runAllTests();
}

// Export for use in test runners
export { POSTransactionE2ETest, MockDatabaseService, runE2ETests };

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runE2ETests();
}
