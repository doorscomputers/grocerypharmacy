import * as SQLite from 'expo-sqlite';
import {
  initializeDatabase,
  getNextInvoiceNumber,
  updateInvoiceNumber,
  getNextPurchaseNumber,
  updatePurchaseNumber,
  getNextPaymentNumber,
  updatePaymentNumber,
  getNextDamageSessionId,
  updateDamageSessionNumber,
  Supplier,
  Purchase,
  PurchaseDetail,
  SupplierPayment,
  AccountsPayable,
  DamagedItemsSession,
  DamagedItemsDetail
} from './schema';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (!this.db) {
      console.log('Initializing database...');

      try {
        // Check if we're on a supported platform
        const Platform = require('react-native').Platform;
        if (Platform.OS === 'web') {
          throw new Error('SQLite is not supported on web platform. Please use iOS/Android simulator or device.');
        }

        console.log('Platform check passed, opening database...');
        this.db = await SQLite.openDatabaseAsync('pos_database.db');
        console.log('Database opened successfully');

        // Test basic database functionality first
        await this.testBasicDatabaseOperations();
        console.log('Basic database operations test passed');

        // Initialize full schema
        await initializeDatabase(this.db);
        console.log('Full database schema initialized successfully');

        // Verify critical tables exist
        await this.verifyCriticalTables();
        console.log('Critical tables verified - initialization complete');

      } catch (error) {
        console.error('Database initialization failed:', error);
        throw error; // Don't fallback, let the error surface properly
      }
    }
  }

  // Test the most basic database operations to ensure SQLite is working
  private async testBasicDatabaseOperations(): Promise<void> {
    const db = this.getDatabase();

    try {
      // Test 1: Simple CREATE TABLE
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
      `);

      // Test 2: Simple INSERT
      await db.runAsync('INSERT OR IGNORE INTO test_table (id, name) VALUES (1, ?)', ['test']);

      // Test 3: Simple SELECT
      const result = await db.getFirstAsync('SELECT * FROM test_table WHERE id = 1');

      // Test 4: Cleanup
      await db.execAsync('DROP TABLE IF EXISTS test_table');

      console.log('✅ Basic database operations test completed successfully');

    } catch (error) {
      console.error('❌ Basic database operations failed:', error);
      throw new Error(`SQLite is not functioning properly: ${error}`);
    }
  }

  // Verify that critical tables exist and create users if needed
  private async verifyCriticalTables(): Promise<void> {
    const db = this.getDatabase();

    // Check if users table has any records
    const userCount = await db.getFirstAsync<{count: number}>(`
      SELECT COUNT(*) as count FROM users WHERE is_active = 1
    `);

    console.log('Active users found:', userCount?.count || 0);

    if (!userCount || userCount.count === 0) {
      console.log('No active users found, creating default users...');
      await this.createDefaultUsers();
    }
  }

  // Minimal initialization if full init fails
  private async minimalInitialization(): Promise<void> {
    const db = this.getDatabase();

    try {
      console.log('Creating essential tables...');

      // Create users table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          role TEXT CHECK (role IN ('ADMIN', 'CASHIER', 'MANAGER')) DEFAULT 'CASHIER',
          is_active BOOLEAN DEFAULT 1,
          password_hash TEXT NOT NULL,
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create products table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          cost DECIMAL(10,2) NOT NULL DEFAULT 0,
          category_id INTEGER,
          tax_rate DECIMAL(5,2) DEFAULT 12.00,
          is_vat_inclusive BOOLEAN DEFAULT 1,
          stock_quantity INTEGER DEFAULT 0,
          unit TEXT DEFAULT 'pcs',
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create settings table for app configuration
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.createDefaultUsers();
      console.log('Minimal initialization completed with essential tables');

    } catch (error) {
      console.error('Even minimal initialization failed:', error);
      throw new Error('Database is completely inaccessible');
    }
  }

  public getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  // ========================================
  // INVENTORY MOVEMENT TRACKING HELPER
  // ========================================

  public async recordInventoryMovement(movementData: {
    product_id: number;
    movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reference_type: 'SALE' | 'PURCHASE' | 'MANUAL_ADJUSTMENT' | 'DAMAGE' | 'DAMAGE_REVERSAL' | 'PHYSICAL_COUNT';
    reference_id?: number;
    reference_number?: string;
    notes?: string;
    created_by: number;
  }): Promise<number> {
    const db = this.getDatabase();

    try {
      // Get current product information including stock before the transaction
      const product = await db.getFirstAsync<any>(
        'SELECT * FROM products WHERE id = ?',
        [movementData.product_id]
      );

      if (!product) {
        throw new Error(`Product with ID ${movementData.product_id} not found`);
      }

      const quantityBefore = product.stock_quantity;
      let quantityAfter: number;

      // Calculate quantity after based on movement type
      switch (movementData.movement_type) {
        case 'IN':
          quantityAfter = quantityBefore + Math.abs(movementData.quantity);
          break;
        case 'OUT':
          quantityAfter = quantityBefore - Math.abs(movementData.quantity);
          break;
        case 'ADJUSTMENT':
          // For adjustments, the quantity represents the final amount, not the change
          quantityAfter = movementData.quantity;
          break;
        default:
          throw new Error(`Invalid movement type: ${movementData.movement_type}`);
      }

      // Ensure stock doesn't go negative (except for adjustments)
      if (quantityAfter < 0 && movementData.movement_type !== 'ADJUSTMENT') {
        throw new Error(`Insufficient stock. Available: ${quantityBefore}, Requested: ${Math.abs(movementData.quantity)}`);
      }

      const actualQuantityMoved = movementData.movement_type === 'ADJUSTMENT'
        ? quantityAfter - quantityBefore
        : movementData.quantity;

      const totalValue = Math.abs(actualQuantityMoved) * product.cost;

      // Record the inventory movement
      const result = await db.runAsync(
        `INSERT INTO inventory_movements (
          product_id, product_code, product_name, movement_type, quantity,
          quantity_before, quantity_after, unit_cost, total_value,
          reference_type, reference_id, reference_number, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementData.product_id,
          product.code,
          product.name,
          movementData.movement_type,
          actualQuantityMoved,
          quantityBefore,
          quantityAfter,
          product.cost,
          totalValue,
          movementData.reference_type,
          movementData.reference_id || null,
          movementData.reference_number || null,
          movementData.notes || null,
          movementData.created_by
        ]
      );

      // Update the product stock quantity
      await db.runAsync(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [quantityAfter, movementData.product_id]
      );

      console.log(`Inventory movement recorded: ${product.name} ${quantityBefore} → ${quantityAfter} (${actualQuantityMoved})`);
      return result.lastInsertRowId as number;
    } catch (error) {
      console.error('Error recording inventory movement:', error);
      throw error;
    }
  }

  // Method to recreate default users if they don't exist
  public async createDefaultUsers(): Promise<void> {
    const db = this.getDatabase();

    try {
      await db.execAsync(`
        INSERT OR IGNORE INTO users (username, full_name, role, password_hash) VALUES
          ('admin', 'System Administrator', 'ADMIN', '$2b$10$demo_hash_admin'),
          ('manager', 'Store Manager', 'MANAGER', '$2b$10$demo_hash_manager'),
          ('cashier', 'Cashier User', 'CASHIER', '$2b$10$demo_hash_cashier');
      `);

      console.log('Default users created/updated successfully');
    } catch (error) {
      console.error('Error creating default users:', error);
      throw error;
    }
  }

  // Product operations
  public async createProduct(product: {
    code: string;
    name: string;
    description?: string;
    price: number;
    cost: number;
    category_id?: number;
    tax_rate?: number;
    is_vat_inclusive?: boolean;
    stock_quantity?: number;
    unit?: string;
    is_active?: boolean;
  }) {
    const db = this.getDatabase();
    try {
      const result = await db.runAsync(
        `INSERT OR REPLACE INTO products (code, name, description, price, cost, category_id, tax_rate, is_vat_inclusive, stock_quantity, unit, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.code,
          product.name,
          product.description || '',
          product.price,
          product.cost,
          product.category_id || null,
          product.tax_rate || 12.00,
          product.is_vat_inclusive !== false ? 1 : 0,
          product.stock_quantity || 0,
          product.unit || 'pcs',
          product.is_active !== false ? 1 : 0
        ]
      );
      console.log(`Product created: ${product.name} (ID: ${result.lastInsertRowId})`);
      return result.lastInsertRowId;
    } catch (error) {
      console.error(`Error creating product ${product.name}:`, error);
      throw error;
    }
  }

  public async getProducts(active_only: boolean = true, limit?: number, searchTerm?: string) {
    const db = this.getDatabase();

    try {
      let whereClause = active_only ? 'WHERE is_active = 1' : 'WHERE 1=1';
      const params: any[] = [];

      // Add search filter if provided
      if (searchTerm && searchTerm.trim() !== '') {
        whereClause += ' AND (name LIKE ? OR code LIKE ?)';
        const searchPattern = `%${searchTerm.trim()}%`;
        params.push(searchPattern, searchPattern);
      }

      // Add limit for performance - no limit when searching to allow full search
      let limitClause = '';
      if (searchTerm && searchTerm.trim() !== '') {
        // When searching, allow unlimited results for complete search
        limitClause = limit ? `LIMIT ${limit}` : '';
      } else {
        // When browsing (no search), limit to prevent performance issues
        limitClause = limit ? `LIMIT ${limit}` : 'LIMIT 100';
      }

      // Use simple query for better performance with large datasets
      const products = await db.getAllAsync<any>(
        `SELECT id, code, name, description, price, cost, category_id, tax_rate,
                is_vat_inclusive, stock_quantity, unit, is_active, created_at, updated_at
         FROM products
         ${whereClause}
         ORDER BY name
         ${limitClause}`,
        params
      );

      console.log(`DatabaseService.getProducts: Found ${products.length} products (limited to ${limit || 100})`);
      return products;

    } catch (error) {
      console.error('Error in getProducts:', error);
      return [];
    }
  }

  // New method for getting products with pagination
  public async getProductsPaginated(
    page: number = 1,
    pageSize: number = 50,
    searchTerm?: string,
    active_only: boolean = true
  ) {
    const db = this.getDatabase();

    try {
      let whereClause = active_only ? 'WHERE is_active = 1' : 'WHERE 1=1';
      const params: any[] = [];

      if (searchTerm && searchTerm.trim() !== '') {
        whereClause += ' AND (name LIKE ? OR code LIKE ?)';
        const searchPattern = `%${searchTerm.trim()}%`;
        params.push(searchPattern, searchPattern);
      }

      const offset = (page - 1) * pageSize;

      const products = await db.getAllAsync<any>(
        `SELECT id, code, name, description, price, cost, category_id, tax_rate,
                is_vat_inclusive, stock_quantity, unit, is_active, created_at, updated_at
         FROM products
         ${whereClause}
         ORDER BY name
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
      );

      // Get total count for pagination
      const countResult = await db.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) as count FROM products ${whereClause}`,
        params
      );

      const totalCount = countResult?.count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        products,
        pagination: {
          currentPage: page,
          pageSize,
          totalCount,
          totalPages,
          hasMore: page < totalPages
        }
      };

    } catch (error) {
      console.error('Error in getProductsPaginated:', error);
      return {
        products: [],
        pagination: {
          currentPage: 1,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasMore: false
        }
      };
    }
  }

  public async getProductByCode(code: string) {
    const db = this.getDatabase();
    return await db.getFirstAsync(
      'SELECT * FROM products WHERE code = ? AND is_active = 1',
      [code]
    );
  }

  // Debug method to check raw products table
  public async getRawProducts() {
    const db = this.getDatabase();
    try {
      const products = await db.getAllAsync('SELECT * FROM products LIMIT 5');
      console.log(`Raw products table has ${products.length} entries`);
      if (products.length > 0) {
        console.log('Raw product sample:', JSON.stringify(products[0], null, 2));
      }
      return products;
    } catch (error) {
      console.error('Error getting raw products:', error);
      return [];
    }
  }

  // Transaction operations
  public async createTransaction(transaction: {
    customer_id?: number;
    customer_name?: string;
    customer_tin?: string;
    customer_address?: string;
    subtotal: number;
    tax_amount: number;
    discount_amount?: number;
    total_amount: number;
    payment_method: string;
    amount_tendered: number;
    change_amount?: number;
    cashier_id: number;
    items: Array<{
      product_id: number;
      product_code: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      discount_amount?: number;
      tax_amount: number;
      total_amount: number;
    }>;
  }) {
    const db = this.getDatabase();

    // Get next transaction and invoice numbers
    const transactionNumber = `TXN${Date.now()}`;
    const invoiceNumber = await getNextInvoiceNumber(db);

    const isChargeInvoice = transaction.payment_method === 'CHARGE_INVOICE';
    const paymentStatus = isChargeInvoice ? 'UNPAID' : 'PAID';

    await db.withTransactionAsync(async () => {
      // Create transaction
      const transactionResult = await db.runAsync(
        `INSERT INTO transactions (
          transaction_number, invoice_number, customer_name, customer_tin, customer_address,
          subtotal, tax_amount, discount_amount, total_amount, payment_method,
          amount_tendered, change_amount, payment_status, cashier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionNumber,
          invoiceNumber,
          transaction.customer_name || '',
          transaction.customer_tin || '',
          transaction.customer_address || '',
          transaction.subtotal,
          transaction.tax_amount,
          transaction.discount_amount || 0,
          transaction.total_amount,
          transaction.payment_method,
          transaction.amount_tendered,
          transaction.change_amount || 0,
          paymentStatus,
          transaction.cashier_id
        ]
      );

      const transactionId = transactionResult.lastInsertRowId;

      // Create transaction items and update inventory
      for (const item of transaction.items) {
        await db.runAsync(
          `INSERT INTO transaction_items (
            transaction_id, product_id, product_code, product_name,
            quantity, unit_price, discount_amount, tax_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionId,
            item.product_id,
            item.product_code,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.discount_amount || 0,
            item.tax_amount,
            item.total_amount
          ]
        );

        // Record inventory movement (this will also update the stock quantity)
        await this.recordInventoryMovement({
          product_id: item.product_id,
          movement_type: 'OUT',
          quantity: item.quantity,
          reference_type: 'SALE',
          reference_id: transactionId as number,
          reference_number: invoiceNumber,
          notes: `Sale: ${item.product_name} (${item.quantity} units)`,
          created_by: transaction.cashier_id
        });
      }

      // Create accounts receivable entry for charge invoices
      if (isChargeInvoice) {
        // Get customer credit terms or use default
        let creditTerms = 30; // default
        if (transaction.customer_id) {
          const customer = await db.getFirstAsync<any>(
            'SELECT credit_terms FROM customers WHERE id = ?',
            [transaction.customer_id]
          );
          if (customer?.credit_terms) {
            creditTerms = customer.credit_terms;
          }
        }

        const invoiceDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + creditTerms);
        const dueDateString = dueDate.toISOString().split('T')[0];

        await db.runAsync(
          `INSERT INTO accounts_receivable (
            transaction_id, customer_id, customer_name, invoice_number,
            invoice_date, due_date, original_amount, balance_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionId,
            transaction.customer_id || null,
            transaction.customer_name || 'Walk-in Customer',
            invoiceNumber,
            invoiceDate,
            dueDateString,
            transaction.total_amount,
            transaction.total_amount
          ]
        );
      }

      // Add eJournal entry
      await db.runAsync(
        `INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          'SALE',
          invoiceNumber,
          `Sale transaction - Invoice: ${invoiceNumber}`,
          transaction.total_amount,
          transaction.cashier_id
        ]
      );

      // Update invoice number
      await updateInvoiceNumber(db, invoiceNumber);
    });

    return { transactionNumber, invoiceNumber };
  }

  // BIR Compliance operations
  public async generateZReading(cashier_id: number): Promise<any> {
    const db = this.getDatabase();

    const today = new Date().toISOString().split('T')[0];

    // Check if Z-Reading already exists for today
    const existingReading = await db.getFirstAsync(
      'SELECT * FROM z_readings WHERE date = ?',
      [today]
    );

    if (existingReading) {
      throw new Error('Z-Reading already generated for today');
    }

    // Get current Z-Reading counter
    const counterResult = await db.getFirstAsync<{value: string}>(
      'SELECT value FROM settings WHERE key = ?',
      ['z_counter']
    );

    const currentCounter = parseInt(counterResult?.value || '0');
    const nextCounter = currentCounter + 1;

    // Calculate sales data for today
    const salesData = await db.getFirstAsync<{
      gross_sales: number;
      vat_amount: number;
      discount_amount: number;
      void_amount: number;
      net_sales: number;
      start_invoice: string;
      end_invoice: string;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as gross_sales,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN tax_amount ELSE 0 END), 0) as vat_amount,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN discount_amount ELSE 0 END), 0) as discount_amount,
         COALESCE(SUM(CASE WHEN status = 'VOID' THEN total_amount ELSE 0 END), 0) as void_amount,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount - discount_amount ELSE 0 END), 0) as net_sales,
         MIN(invoice_number) as start_invoice,
         MAX(invoice_number) as end_invoice
       FROM transactions
       WHERE DATE(transaction_date) = ?`,
      [today]
    );

    const vat_sales = salesData?.gross_sales ? (salesData.gross_sales / 1.12) : 0;

    // Create Z-Reading record
    const result = await db.runAsync(
      `INSERT INTO z_readings (
        reading_number, date, start_invoice_number, end_invoice_number,
        gross_sales, vat_sales, vat_amount, discount_amount, void_amount, net_sales,
        reset_counter, cashier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextCounter,
        today,
        salesData?.start_invoice || '',
        salesData?.end_invoice || '',
        salesData?.gross_sales || 0,
        vat_sales,
        salesData?.vat_amount || 0,
        salesData?.discount_amount || 0,
        salesData?.void_amount || 0,
        salesData?.net_sales || 0,
        nextCounter,
        cashier_id
      ]
    );

    // Update Z-Reading counter
    await db.runAsync(
      'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [nextCounter.toString(), 'z_counter']
    );

    // Add eJournal entry
    await db.runAsync(
      `INSERT INTO ejournal (entry_type, reference_number, description, cashier_id)
       VALUES (?, ?, ?, ?)`,
      ['Z_READING', `Z${nextCounter.toString().padStart(4, '0')}`, `Z-Reading #${nextCounter}`, cashier_id]
    );

    return {
      reading_number: nextCounter,
      date: today,
      ...salesData,
      vat_sales,
      reset_counter: nextCounter
    };
  }

  public async generateXReading(cashier_id: number): Promise<any> {
    const db = this.getDatabase();

    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0];

    // Calculate current day sales data
    const salesData = await db.getFirstAsync<{
      gross_sales: number;
      vat_amount: number;
      discount_amount: number;
      void_amount: number;
      net_sales: number;
      transaction_count: number;
      current_invoice: string;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as gross_sales,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN tax_amount ELSE 0 END), 0) as vat_amount,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN discount_amount ELSE 0 END), 0) as discount_amount,
         COALESCE(SUM(CASE WHEN status = 'VOID' THEN total_amount ELSE 0 END), 0) as void_amount,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount - discount_amount ELSE 0 END), 0) as net_sales,
         COUNT(*) as transaction_count,
         MAX(invoice_number) as current_invoice
       FROM transactions
       WHERE DATE(transaction_date) = ?`,
      [today]
    );

    const vat_sales = salesData?.gross_sales ? (salesData.gross_sales / 1.12) : 0;

    // Create X-Reading record
    await db.runAsync(
      `INSERT INTO x_readings (
        date, time, current_invoice_number, gross_sales, vat_sales, vat_amount,
        discount_amount, void_amount, net_sales, transaction_count, cashier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        today,
        currentTime,
        salesData?.current_invoice || '',
        salesData?.gross_sales || 0,
        vat_sales,
        salesData?.vat_amount || 0,
        salesData?.discount_amount || 0,
        salesData?.void_amount || 0,
        salesData?.net_sales || 0,
        salesData?.transaction_count || 0,
        cashier_id
      ]
    );

    // Add eJournal entry
    await db.runAsync(
      `INSERT INTO ejournal (entry_type, reference_number, description, cashier_id)
       VALUES (?, ?, ?, ?)`,
      ['X_READING', `X${Date.now()}`, `X-Reading ${currentTime}`, cashier_id]
    );

    return {
      date: today,
      time: currentTime,
      ...salesData,
      vat_sales
    };
  }

  // User authentication
  public async authenticateUser(username: string, password: string) {
    const db = this.getDatabase();

    console.log('🔐 Authentication attempt:');
    console.log('  Username:', username);
    console.log('  Password provided:', password ? 'Yes' : 'No');

    try {
      // First, check if any users exist
      const allUsers = await db.getAllAsync<any>('SELECT username, is_active FROM users');
      console.log('  Total users in database:', allUsers.length);
      console.log('  Users:', allUsers);

      const user = await db.getFirstAsync<any>(
        'SELECT id, username, full_name, role, is_active FROM users WHERE username = ? AND is_active = 1',
        [username]
      );

      if (user) {
        console.log('  User found:', user);
        return user;
      }

    } catch (error) {
      console.error('  Database query failed during authentication:', error);
      console.log('  Attempting to check/create users table...');

      try {
        // Ensure users table exists
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            full_name TEXT NOT NULL,
            role TEXT CHECK (role IN ('ADMIN', 'CASHIER', 'MANAGER')) DEFAULT 'CASHIER',
            is_active BOOLEAN DEFAULT 1,
            password_hash TEXT NOT NULL,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await this.createDefaultUsers();
        console.log('  Users table created/verified, retrying authentication...');

        const retryUser = await db.getFirstAsync<any>(
          'SELECT id, username, full_name, role, is_active FROM users WHERE username = ? AND is_active = 1',
          [username]
        );

        if (retryUser) {
          console.log('  Authentication successful after table creation:', retryUser);
          return retryUser;
        }

      } catch (createError) {
        console.error('  Failed to create users table:', createError);
      }
    }

    console.log('  Authentication failed - no user found');
    return null;
  }

  public async updateUserLastLogin(userId: number): Promise<void> {
    const db = this.getDatabase();
    await db.runAsync(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
  }

  public async createEJournalEntry(entry: {
    transaction_id?: number;
    entry_type: 'SALE' | 'VOID' | 'REFUND' | 'Z_READING' | 'X_READING' | 'SYSTEM';
    reference_number: string;
    description: string;
    amount?: number;
    cashier_id: number;
  }): Promise<void> {
    const db = this.getDatabase();
    await db.runAsync(
      'INSERT INTO ejournal (transaction_id, entry_type, reference_number, description, amount, cashier_id) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.transaction_id || null, entry.entry_type, entry.reference_number, entry.description, entry.amount || null, entry.cashier_id]
    );
  }

  public async getUsers(): Promise<any[]> {
    const db = this.getDatabase();
    return await db.getAllAsync(
      'SELECT id, username, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
  }

  public async createUser(userData: {
    username: string;
    full_name: string;
    role: 'ADMIN' | 'CASHIER' | 'MANAGER';
    password_hash: string;
  }): Promise<void> {
    const db = this.getDatabase();
    await db.runAsync(
      'INSERT INTO users (username, full_name, role, password_hash) VALUES (?, ?, ?, ?)',
      [userData.username, userData.full_name, userData.role, userData.password_hash]
    );
  }

  public async updateUser(userId: number, userData: {
    full_name?: string;
    role?: 'ADMIN' | 'CASHIER' | 'MANAGER';
    is_active?: boolean;
  }): Promise<void> {
    const db = this.getDatabase();
    const setParts = [];
    const values = [];

    if (userData.full_name !== undefined) {
      setParts.push('full_name = ?');
      values.push(userData.full_name);
    }
    if (userData.role !== undefined) {
      setParts.push('role = ?');
      values.push(userData.role);
    }
    if (userData.is_active !== undefined) {
      setParts.push('is_active = ?');
      values.push(userData.is_active ? 1 : 0);
    }

    if (setParts.length > 0) {
      setParts.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      await db.runAsync(
        `UPDATE users SET ${setParts.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  public async getTransactionsByCashier(cashierId: number, limit?: number): Promise<any[]> {
    const db = this.getDatabase();
    const query = `
      SELECT t.*, u.full_name as cashier_name
      FROM transactions t
      JOIN users u ON t.cashier_id = u.id
      WHERE t.cashier_id = ?
      ORDER BY t.created_at DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `;
    return await db.getAllAsync(query, [cashierId]);
  }

  // Dynamic permission management
  public async getRolePermissions(role?: 'MANAGER' | 'CASHIER'): Promise<any[]> {
    const db = this.getDatabase();
    const query = role
      ? 'SELECT * FROM role_permissions WHERE role = ? ORDER BY permission'
      : 'SELECT * FROM role_permissions ORDER BY role, permission';
    const params = role ? [role] : [];
    return await db.getAllAsync(query, params);
  }

  public async updateRolePermission(
    role: 'MANAGER' | 'CASHIER',
    permission: string,
    isEnabled: boolean,
    updatedBy: number
  ): Promise<void> {
    const db = this.getDatabase();
    await db.runAsync(
      'UPDATE role_permissions SET is_enabled = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ? AND permission = ?',
      [isEnabled ? 1 : 0, updatedBy, role, permission]
    );
  }

  public async getEnabledPermissionsForRole(role: 'MANAGER' | 'CASHIER'): Promise<string[]> {
    const db = this.getDatabase();
    const result = await db.getAllAsync<{permission: string}>(
      'SELECT permission FROM role_permissions WHERE role = ? AND is_enabled = 1',
      [role]
    );
    return result.map(row => row.permission);
  }

  public async resetRolePermissions(role: 'MANAGER' | 'CASHIER', updatedBy: number): Promise<void> {
    const db = this.getDatabase();
    // Reset to default permissions based on role
    if (role === 'MANAGER') {
      // Enable all manager permissions
      await db.runAsync(
        'UPDATE role_permissions SET is_enabled = 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ?',
        [updatedBy, role]
      );
    } else if (role === 'CASHIER') {
      // Reset to default cashier permissions
      await db.runAsync(
        'UPDATE role_permissions SET is_enabled = CASE permission WHEN ? THEN 1 WHEN ? THEN 1 WHEN ? THEN 1 ELSE 0 END, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ?',
        ['VIEW_DASHBOARD', 'CREATE_SALE', 'VIEW_OWN_SALES', 'VIEW_PRODUCTS', updatedBy, role]
      );
    }
  }

  // Settings operations
  public async getSetting(key: string): Promise<string | null> {
    const db = this.getDatabase();
    const result = await db.getFirstAsync<{value: string}>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return result?.value || null;
  }

  public async updateSetting(key: string, value: string): Promise<void> {
    const db = this.getDatabase();
    await db.runAsync(
      'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [value, key]
    );
  }

  // Get today's transactions for reporting
  public async getTodaysTransactions() {
    const db = this.getDatabase();
    const today = new Date().toISOString().split('T')[0];

    return await db.getAllAsync(
      `SELECT t.*, u.full_name as cashier_name
       FROM transactions t
       JOIN users u ON t.cashier_id = u.id
       WHERE DATE(t.transaction_date) = ?
       ORDER BY t.created_at DESC`,
      [today]
    );
  }

  // Physical Count Session Management
  public async createPhysicalCountSession(sessionData: {
    session_id: string;
    started_by: number;
    total_items: number;
    notes?: string;
  }) {
    const db = this.getDatabase();
    const today = new Date().toISOString().split('T')[0];

    return await db.runAsync(
      `INSERT INTO physical_count_sessions (session_id, date, started_by, total_items, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionData.session_id, today, sessionData.started_by, sessionData.total_items, sessionData.notes || null]
    );
  }

  public async updatePhysicalCountSession(sessionId: string, updates: {
    counted_items?: number;
    discrepancy_count?: number;
    total_discrepancy_value?: number;
    status?: 'in_progress' | 'completed' | 'cancelled';
    completed_by?: number;
    notes?: string;
  }) {
    const db = this.getDatabase();
    const setParts = [];
    const values = [];

    if (updates.counted_items !== undefined) {
      setParts.push('counted_items = ?');
      values.push(updates.counted_items);
    }
    if (updates.discrepancy_count !== undefined) {
      setParts.push('discrepancy_count = ?');
      values.push(updates.discrepancy_count);
    }
    if (updates.total_discrepancy_value !== undefined) {
      setParts.push('total_discrepancy_value = ?');
      values.push(updates.total_discrepancy_value);
    }
    if (updates.status !== undefined) {
      setParts.push('status = ?');
      values.push(updates.status);
      if (updates.status === 'completed') {
        setParts.push('completed_at = CURRENT_TIMESTAMP');
      }
    }
    if (updates.completed_by !== undefined) {
      setParts.push('completed_by = ?');
      values.push(updates.completed_by);
    }
    if (updates.notes !== undefined) {
      setParts.push('notes = ?');
      values.push(updates.notes);
    }

    if (setParts.length > 0) {
      values.push(sessionId);
      await db.runAsync(
        `UPDATE physical_count_sessions SET ${setParts.join(', ')} WHERE session_id = ?`,
        values
      );
    }
  }

  public async createPhysicalCountDetail(detailData: {
    session_id: string;
    product_id: number;
    product_code: string;
    product_name: string;
    system_quantity: number;
    unit_cost: number;
  }) {
    const db = this.getDatabase();

    return await db.runAsync(
      `INSERT INTO physical_count_details
       (session_id, product_id, product_code, product_name, system_quantity, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        detailData.session_id,
        detailData.product_id,
        detailData.product_code,
        detailData.product_name,
        detailData.system_quantity,
        detailData.unit_cost
      ]
    );
  }

  public async updatePhysicalCountDetail(sessionId: string, productId: number, updates: {
    physical_quantity?: number;
    discrepancy?: number;
    value_discrepancy?: number;
    status?: 'pending' | 'counted' | 'reviewed';
    counted_by?: number;
    notes?: string;
  }) {
    const db = this.getDatabase();
    const setParts = [];
    const values = [];

    if (updates.physical_quantity !== undefined) {
      setParts.push('physical_quantity = ?');
      values.push(updates.physical_quantity);
    }
    if (updates.discrepancy !== undefined) {
      setParts.push('discrepancy = ?');
      values.push(updates.discrepancy);
    }
    if (updates.value_discrepancy !== undefined) {
      setParts.push('value_discrepancy = ?');
      values.push(updates.value_discrepancy);
    }
    if (updates.status !== undefined) {
      setParts.push('status = ?');
      values.push(updates.status);
      if (updates.status === 'counted') {
        setParts.push('counted_at = CURRENT_TIMESTAMP');
      }
    }
    if (updates.counted_by !== undefined) {
      setParts.push('counted_by = ?');
      values.push(updates.counted_by);
    }
    if (updates.notes !== undefined) {
      setParts.push('notes = ?');
      values.push(updates.notes);
    }

    if (setParts.length > 0) {
      values.push(sessionId, productId);
      await db.runAsync(
        `UPDATE physical_count_details SET ${setParts.join(', ')} WHERE session_id = ? AND product_id = ?`,
        values
      );
    }
  }

  public async getPhysicalCountSessions(limit?: number) {
    const db = this.getDatabase();
    const query = `
      SELECT
        pcs.*,
        u1.full_name as started_by_name,
        u2.full_name as completed_by_name
      FROM physical_count_sessions pcs
      LEFT JOIN users u1 ON pcs.started_by = u1.id
      LEFT JOIN users u2 ON pcs.completed_by = u2.id
      ORDER BY pcs.created_at DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `;
    return await db.getAllAsync(query);
  }

  public async getPhysicalCountDetails(sessionId: string) {
    const db = this.getDatabase();
    return await db.getAllAsync(
      `SELECT
        pcd.*,
        u.full_name as counted_by_name
       FROM physical_count_details pcd
       LEFT JOIN users u ON pcd.counted_by = u.id
       WHERE pcd.session_id = ?
       ORDER BY pcd.product_name`,
      [sessionId]
    );
  }

  public async getPhysicalCountReport(sessionId?: string, startDate?: string, endDate?: string) {
    const db = this.getDatabase();

    try {
      // Use simple, fast queries without complex JOINs
      console.log('Loading Physical Count Report...');

      // Build where clause for sessions
      let sessionWhereClause = 'WHERE 1=1';
      const sessionParams: any[] = [];

      if (sessionId) {
        sessionWhereClause += ' AND pcs.session_id = ?';
        sessionParams.push(sessionId);
      }
      if (startDate) {
        sessionWhereClause += ' AND DATE(pcs.date) >= DATE(?)';
        sessionParams.push(startDate);
      }
      if (endDate) {
        sessionWhereClause += ' AND DATE(pcs.date) <= DATE(?)';
        sessionParams.push(endDate);
      }

      // Get sessions with user names (optimized query)
      const sessions = await db.getAllAsync<any>(`
        SELECT pcs.session_id, pcs.date, pcs.status, pcs.started_by, pcs.completed_by,
               pcs.started_at, pcs.completed_at, pcs.total_items, pcs.counted_items,
               pcs.discrepancy_count, pcs.total_discrepancy_value, pcs.notes,
               u1.username as started_by_name,
               u2.username as completed_by_name
        FROM physical_count_sessions pcs
        LEFT JOIN users u1 ON pcs.started_by = u1.id
        LEFT JOIN users u2 ON pcs.completed_by = u2.id
        ${sessionWhereClause}
        ORDER BY pcs.date DESC
        LIMIT 50
      `, sessionParams);

      if (sessions.length === 0) {
        console.log('No sessions found');
        return [];
      }

      console.log(`Found ${sessions.length} sessions`);

      // Get details for these sessions (simple query)
      const sessionIds = sessions.map(s => s.session_id);
      const placeholders = sessionIds.map(() => '?').join(',');

      const details = await db.getAllAsync<any>(`
        SELECT pcd.session_id, pcd.product_code, pcd.product_name, pcd.system_quantity,
               pcd.physical_quantity, pcd.discrepancy, pcd.value_discrepancy, pcd.status,
               pcd.counted_by, pcd.counted_at, pcd.notes,
               u.username as counted_by_name
        FROM physical_count_details pcd
        LEFT JOIN users u ON pcd.counted_by = u.id
        WHERE pcd.session_id IN (${placeholders})
        ORDER BY pcd.session_id, pcd.product_name
      `, sessionIds);

      console.log(`Found ${details.length} detail records`);

      // Combine data efficiently
      const result = [];
      for (const session of sessions) {
        const sessionDetails = details.filter(d => d.session_id === session.session_id);

        if (sessionDetails.length > 0) {
          // Add each detail with session info
          for (const detail of sessionDetails) {
            result.push({
              ...session,
              ...detail,
              item_status: detail.status
            });
          }
        } else {
          // Add session without details
          result.push({
            ...session,
            product_code: null,
            product_name: null,
            system_quantity: 0,
            physical_quantity: 0,
            discrepancy: 0,
            value_discrepancy: 0,
            item_status: null,
            counted_by: null,
            counted_at: null,
            item_notes: null
          });
        }
      }

      console.log(`Returning ${result.length} combined records`);
      return result;

    } catch (error) {
      console.error('Error in getPhysicalCountReport:', error);
      return [];
    }
  }

  // Product update methods
  public async updateProduct(productId: number, updates: {
    code?: string;
    name?: string;
    description?: string;
    price?: number;
    cost?: number;
    category_id?: number;
    tax_rate?: number;
    is_vat_inclusive?: boolean;
    stock_quantity?: number;
    unit?: string;
    is_active?: boolean;
  }) {
    const db = this.getDatabase();
    const setParts = [];
    const values = [];

    if (updates.code !== undefined) {
      setParts.push('code = ?');
      values.push(updates.code);
    }
    if (updates.name !== undefined) {
      setParts.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setParts.push('description = ?');
      values.push(updates.description);
    }
    if (updates.price !== undefined) {
      setParts.push('price = ?');
      values.push(updates.price);
    }
    if (updates.cost !== undefined) {
      setParts.push('cost = ?');
      values.push(updates.cost);
    }
    if (updates.category_id !== undefined) {
      setParts.push('category_id = ?');
      values.push(updates.category_id);
    }
    if (updates.tax_rate !== undefined) {
      setParts.push('tax_rate = ?');
      values.push(updates.tax_rate);
    }
    if (updates.is_vat_inclusive !== undefined) {
      setParts.push('is_vat_inclusive = ?');
      values.push(updates.is_vat_inclusive ? 1 : 0);
    }
    if (updates.stock_quantity !== undefined) {
      setParts.push('stock_quantity = ?');
      values.push(updates.stock_quantity);
    }
    if (updates.unit !== undefined) {
      setParts.push('unit = ?');
      values.push(updates.unit);
    }
    if (updates.is_active !== undefined) {
      setParts.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    if (setParts.length > 0) {
      setParts.push('updated_at = CURRENT_TIMESTAMP');
      values.push(productId);

      const result = await db.runAsync(
        `UPDATE products SET ${setParts.join(', ')} WHERE id = ?`,
        values
      );

      console.log(`Product ${productId} updated. Changes affected: ${result.changes}`);
      return result.changes > 0;
    }

    return false;
  }

  // Debug method to check physical count data integrity
  public async debugPhysicalCountData() {
    const db = this.getDatabase();

    try {
      console.log('\n=== PHYSICAL COUNT DEBUG ===');

      // Simple session count check
      const sessionCount = await db.getFirstAsync<{count: number}>(`
        SELECT COUNT(*) as count FROM physical_count_sessions
      `);
      console.log('Total sessions:', sessionCount?.count || 0);

      // Simple details count check
      const detailCount = await db.getFirstAsync<{count: number}>(`
        SELECT COUNT(*) as count FROM physical_count_details
      `);
      console.log('Total details:', detailCount?.count || 0);

      console.log('=== END DEBUG ===\n');
    } catch (error) {
      console.error('Debug method failed:', error);
    }
  }

  public async toggleProductActive(productId: number): Promise<boolean> {
    const db = this.getDatabase();

    // Get current active status
    const product = await db.getFirstAsync<{is_active: number}>(
      'SELECT is_active FROM products WHERE id = ?',
      [productId]
    );

    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    const newActiveStatus = product.is_active === 1 ? 0 : 1;

    const result = await db.runAsync(
      'UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newActiveStatus, productId]
    );

    console.log(`Product ${productId} active status toggled to ${newActiveStatus === 1 ? 'active' : 'inactive'}`);
    return result.changes > 0;
  }

  // Method to create test physical count data for demonstration
  public async createTestPhysicalCountData() {
    const db = this.getDatabase();

    try {
      console.log('Creating test physical count data...');

      // Get admin user ID
      const admin = await db.getFirstAsync<any>('SELECT id FROM users WHERE username = "admin"');
      if (!admin) {
        console.log('Admin user not found, cannot create test data');
        return;
      }

      // Get some products to count
      const products = await db.getAllAsync<any>('SELECT id, code, name, stock_quantity, cost FROM products LIMIT 5');
      if (products.length === 0) {
        console.log('No products found, cannot create test data');
        return;
      }

      // Create a test session
      const sessionId = `PC_${Date.now()}`;
      const sessionDate = new Date();
      const startDate = new Date(sessionDate.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000)); // Random date in last 30 days

      // Insert physical count session
      await db.runAsync(`
        INSERT INTO physical_count_sessions (
          session_id, date, status, started_by, completed_by, started_at, completed_at,
          total_items, counted_items, discrepancy_count, total_discrepancy_value, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId,
        startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        'completed',
        admin.id,
        admin.id,
        startDate.toISOString(),
        new Date(startDate.getTime() + (2 * 60 * 60 * 1000)).toISOString(), // 2 hours later
        products.length,
        products.length,
        Math.floor(products.length / 2), // Some discrepancies
        (Math.random() * 1000 - 500).toFixed(2), // Random discrepancy value
        'Test physical count session for demonstration'
      ]);

      // Insert physical count details
      for (const product of products) {
        const systemQty = product.stock_quantity;
        const physicalQty = Math.max(0, systemQty + Math.floor(Math.random() * 20 - 10)); // Random variance
        const discrepancy = physicalQty - systemQty;

        await db.runAsync(`
          INSERT INTO physical_count_details (
            session_id, product_id, product_code, product_name, system_quantity, physical_quantity,
            discrepancy, unit_cost, value_discrepancy, status, counted_by, counted_at, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sessionId,
          product.id,
          product.code,
          product.name,
          systemQty,
          physicalQty,
          discrepancy,
          product.cost || 10, // Use product cost or default to ₱10
          discrepancy * (product.cost || 10), // Value discrepancy based on cost
          'counted',
          admin.id,
          new Date(startDate.getTime() + (Math.random() * 2 * 60 * 60 * 1000)).toISOString(), // Random time during session
          discrepancy !== 0 ? `Discrepancy of ${discrepancy} units found` : null
        ]);
      }

      console.log(`Created test physical count session ${sessionId} with ${products.length} items`);
      return sessionId;

    } catch (error) {
      console.error('Error creating test physical count data:', error);
      throw error;
    }
  }

  // Clean up all physical inventory data and reset stock quantities
  public async clearPhysicalInventoryData(): Promise<void> {
    const db = this.getDatabase();

    try {
      console.log('Starting physical inventory data cleanup...');

      // Delete all physical count details
      await db.runAsync('DELETE FROM physical_count_details');
      console.log('Cleared physical_count_details table');

      // Delete all physical count sessions
      await db.runAsync('DELETE FROM physical_count_sessions');
      console.log('Cleared physical_count_sessions table');

      // Delete related ejournal entries
      await db.runAsync(`DELETE FROM ejournal WHERE entry_type = 'PHYSICAL_COUNT' OR description LIKE '%Physical inventory%' OR description LIKE '%Physical count%'`);
      console.log('Cleared physical count ejournal entries');

      // Reset all product stock quantities to zero
      await db.runAsync('UPDATE products SET stock_quantity = 0');
      console.log('Reset all product stock quantities to zero');

      // Delete any inventory movements related to physical counts
      await db.runAsync(`DELETE FROM inventory_movements WHERE movement_type = 'ADJUSTMENT' AND reference_type = 'MANUAL_ADJUSTMENT' AND notes LIKE '%PHYSICAL_COUNT%'`);
      console.log('Cleared physical count inventory movements');

      console.log('Physical inventory data cleanup completed successfully!');

    } catch (error) {
      console.error('Error during physical inventory cleanup:', error);
      throw error;
    }
  }

  // ========================================
  // SUPPLIER MANAGEMENT METHODS
  // ========================================

  public async createSupplier(supplierData: {
    code: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    tin?: string;
    credit_terms?: number;
    credit_limit?: number;
    notes?: string;
  }): Promise<number> {
    const db = this.getDatabase();

    try {
      const result = await db.runAsync(
        `INSERT INTO suppliers (code, name, contact_person, phone, email, address, tin, credit_terms, credit_limit, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          supplierData.code,
          supplierData.name,
          supplierData.contact_person || null,
          supplierData.phone || null,
          supplierData.email || null,
          supplierData.address || null,
          supplierData.tin || null,
          supplierData.credit_terms || 30,
          supplierData.credit_limit || 0,
          supplierData.notes || null
        ]
      );

      console.log(`Supplier created: ${supplierData.name} (ID: ${result.lastInsertRowId})`);
      return result.lastInsertRowId as number;
    } catch (error) {
      console.error(`Error creating supplier ${supplierData.name}:`, error);
      throw error;
    }
  }

  public async getSuppliers(active_only: boolean = true): Promise<Supplier[]> {
    const db = this.getDatabase();

    try {
      const whereClause = active_only ? 'WHERE is_active = 1' : '';
      const suppliers = await db.getAllAsync<Supplier>(
        `SELECT * FROM suppliers ${whereClause} ORDER BY name`
      );

      console.log(`Found ${suppliers.length} suppliers`);
      return suppliers;
    } catch (error) {
      console.error('Error getting suppliers:', error);
      return [];
    }
  }

  public async getSupplierById(id: number): Promise<Supplier | null> {
    const db = this.getDatabase();

    try {
      const supplier = await db.getFirstAsync<Supplier>(
        'SELECT * FROM suppliers WHERE id = ?',
        [id]
      );
      return supplier || null;
    } catch (error) {
      console.error(`Error getting supplier ${id}:`, error);
      return null;
    }
  }

  public async updateSupplier(id: number, updates: Partial<Supplier>): Promise<boolean> {
    const db = this.getDatabase();

    try {
      const setParts = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at' && value !== undefined) {
          setParts.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (setParts.length > 0) {
        setParts.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const result = await db.runAsync(
          `UPDATE suppliers SET ${setParts.join(', ')} WHERE id = ?`,
          values
        );

        return result.changes > 0;
      }

      return false;
    } catch (error) {
      console.error(`Error updating supplier ${id}:`, error);
      throw error;
    }
  }

  // ========================================
  // PURCHASE ORDER MANAGEMENT METHODS
  // ========================================

  public async createPurchaseOrder(purchaseData: {
    supplier_id: number;
    expected_delivery_date?: string;
    reference_number?: string;
    payment_terms?: string;
    notes?: string;
    created_by: number;
    items: Array<{
      product_id: number;
      product_code: string;
      product_name: string;
      quantity_ordered: number;
      unit_cost: number;
      discount_amount?: number;
      tax_amount?: number;
    }>;
  }): Promise<{ purchaseId: number; purchaseNumber: string }> {
    const db = this.getDatabase();

    try {
      const purchaseNumber = await getNextPurchaseNumber(db);
      const today = new Date().toISOString().split('T')[0];

      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      for (const item of purchaseData.items) {
        const itemTotal = item.quantity_ordered * item.unit_cost;
        subtotal += itemTotal;
        totalTax += item.tax_amount || 0;
        totalDiscount += item.discount_amount || 0;
      }

      const total = subtotal + totalTax - totalDiscount;

      let purchaseId: number;

      await db.withTransactionAsync(async () => {
        // Create purchase order
        const purchaseResult = await db.runAsync(
          `INSERT INTO purchases (
            purchase_number, supplier_id, purchase_date, expected_delivery_date,
            reference_number, subtotal, tax_amount, discount_amount, total_amount,
            balance_amount, payment_terms, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            purchaseNumber,
            purchaseData.supplier_id,
            today,
            purchaseData.expected_delivery_date || null,
            purchaseData.reference_number || null,
            subtotal,
            totalTax,
            totalDiscount,
            total,
            total, // Initial balance equals total
            purchaseData.payment_terms || '30 days',
            purchaseData.notes || null,
            purchaseData.created_by
          ]
        );

        purchaseId = purchaseResult.lastInsertRowId as number;

        // Create purchase details
        for (const item of purchaseData.items) {
          const itemTotal = (item.quantity_ordered * item.unit_cost) + (item.tax_amount || 0) - (item.discount_amount || 0);

          await db.runAsync(
            `INSERT INTO purchase_details (
              purchase_id, product_id, product_code, product_name,
              quantity_ordered, unit_cost, discount_amount, tax_amount, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              purchaseId,
              item.product_id,
              item.product_code,
              item.product_name,
              item.quantity_ordered,
              item.unit_cost,
              item.discount_amount || 0,
              item.tax_amount || 0,
              itemTotal
            ]
          );
        }

        // Create accounts payable entry
        const dueDate = new Date();
        const creditTerms = await this.getSupplierById(purchaseData.supplier_id);
        if (creditTerms?.credit_terms) {
          dueDate.setDate(dueDate.getDate() + creditTerms.credit_terms);
        } else {
          dueDate.setDate(dueDate.getDate() + 30); // Default 30 days
        }

        await db.runAsync(
          `INSERT INTO accounts_payable (
            purchase_id, supplier_id, invoice_date, due_date,
            original_amount, balance_amount
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            purchaseId,
            purchaseData.supplier_id,
            today,
            dueDate.toISOString().split('T')[0],
            total,
            total
          ]
        );

        // Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'SYSTEM',
            purchaseNumber,
            `Purchase order created - ${purchaseNumber}`,
            total,
            purchaseData.created_by
          ]
        );

        // Update purchase number
        await updatePurchaseNumber(db, purchaseNumber);
      });

      return { purchaseId: purchaseId!, purchaseNumber };
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }

  public async getPurchaseOrders(limit?: number): Promise<any[]> {
    const db = this.getDatabase();

    try {
      const query = `
        SELECT
          p.*,
          s.name as supplier_name,
          s.contact_person,
          u.full_name as created_by_name
        FROM purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
        ${limit ? `LIMIT ${limit}` : ''}
      `;

      return await db.getAllAsync(query);
    } catch (error) {
      console.error('Error getting purchase orders:', error);
      return [];
    }
  }

  public async getPurchaseOrderById(id: number): Promise<any> {
    const db = this.getDatabase();

    try {
      const purchase = await db.getFirstAsync(
        `SELECT
          p.*,
          s.name as supplier_name,
          s.contact_person,
          s.phone,
          s.email,
          s.address,
          u.full_name as created_by_name
        FROM purchases p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN users u ON p.created_by = u.id
        WHERE p.id = ?`,
        [id]
      );

      if (purchase) {
        // Get purchase details
        const details = await db.getAllAsync(
          `SELECT pd.*, p.name as product_name_current
           FROM purchase_details pd
           LEFT JOIN products p ON pd.product_id = p.id
           WHERE pd.purchase_id = ?
           ORDER BY pd.product_name`,
          [id]
        );

        purchase.items = details;
      }

      return purchase;
    } catch (error) {
      console.error(`Error getting purchase order ${id}:`, error);
      return null;
    }
  }

  public async receivePurchaseOrder(
    purchaseId: number,
    receivedBy: number,
    items: Array<{
      product_id: number;
      quantity_received: number;
    }>
  ): Promise<void> {
    const db = this.getDatabase();

    try {
      await db.withTransactionAsync(async () => {
        // Get purchase information
        const purchase = await db.getFirstAsync<any>(
          'SELECT purchase_number FROM purchases WHERE id = ?',
          [purchaseId]
        );

        // Update purchase details with received quantities
        for (const item of items) {
          await db.runAsync(
            'UPDATE purchase_details SET quantity_received = quantity_received + ? WHERE purchase_id = ? AND product_id = ?',
            [item.quantity_received, purchaseId, item.product_id]
          );

          // Update product stock and cost
          const purchaseDetail = await db.getFirstAsync<any>(
            'SELECT unit_cost FROM purchase_details WHERE purchase_id = ? AND product_id = ?',
            [purchaseId, item.product_id]
          );

          if (purchaseDetail) {
            // Record inventory movement with before/after tracking
            await this.recordInventoryMovement({
              product_id: item.product_id,
              movement_type: 'IN',
              quantity: item.quantity_received,
              reference_type: 'PURCHASE',
              reference_id: purchaseId,
              reference_number: purchase?.purchase_number,
              notes: `Purchase receiving - PO #${purchase?.purchase_number}`,
              created_by: receivedBy
            });

            // Update product cost with the purchase cost
            await db.runAsync(
              'UPDATE products SET cost = ? WHERE id = ?',
              [purchaseDetail.unit_cost, item.product_id]
            );
          }
        }

        // Check if all items are fully received
        const pendingItems = await db.getFirstAsync<{count: number}>(
          'SELECT COUNT(*) as count FROM purchase_details WHERE purchase_id = ? AND quantity_received < quantity_ordered',
          [purchaseId]
        );

        const newStatus = (pendingItems?.count || 0) > 0 ? 'PARTIALLY_RECEIVED' : 'RECEIVED';

        // Update purchase status
        await db.runAsync(
          'UPDATE purchases SET status = ?, received_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, receivedBy, purchaseId]
        );

        // Add eJournal entry
        if (purchase) {
          await db.runAsync(
            `INSERT INTO ejournal (entry_type, reference_number, description, cashier_id)
             VALUES (?, ?, ?, ?)`,
            [
              'SYSTEM',
              purchase.purchase_number,
              `Purchase ${newStatus.toLowerCase()} - ${purchase.purchase_number}`,
              receivedBy
            ]
          );
        }
      });
    } catch (error) {
      console.error(`Error receiving purchase order ${purchaseId}:`, error);
      throw error;
    }
  }

  // ========================================
  // SUPPLIER PAYMENT METHODS
  // ========================================

  public async createSupplierPayment(paymentData: {
    supplier_id: number;
    purchase_id?: number;
    payment_method: 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'ONLINE';
    reference_number?: string;
    amount: number;
    notes?: string;
    created_by: number;
  }): Promise<{ paymentId: number; paymentNumber: string }> {
    const db = this.getDatabase();

    try {
      const paymentNumber = await getNextPaymentNumber(db);
      const today = new Date().toISOString().split('T')[0];

      let paymentId: number;

      await db.withTransactionAsync(async () => {
        // Create payment record
        const paymentResult = await db.runAsync(
          `INSERT INTO supplier_payments (
            payment_number, supplier_id, purchase_id, payment_date,
            payment_method, reference_number, amount, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentNumber,
            paymentData.supplier_id,
            paymentData.purchase_id || null,
            today,
            paymentData.payment_method,
            paymentData.reference_number || null,
            paymentData.amount,
            paymentData.notes || null,
            paymentData.created_by
          ]
        );

        paymentId = paymentResult.lastInsertRowId as number;

        // Update accounts payable if payment is for a specific purchase
        if (paymentData.purchase_id) {
          await db.runAsync(
            'UPDATE accounts_payable SET paid_amount = paid_amount + ?, balance_amount = balance_amount - ?, updated_at = CURRENT_TIMESTAMP WHERE purchase_id = ?',
            [paymentData.amount, paymentData.amount, paymentData.purchase_id]
          );

          // Update purchase paid amount
          await db.runAsync(
            'UPDATE purchases SET paid_amount = paid_amount + ?, balance_amount = balance_amount - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [paymentData.amount, paymentData.amount, paymentData.purchase_id]
          );

          // Check if fully paid
          const purchase = await db.getFirstAsync<{balance_amount: number}>(
            'SELECT balance_amount FROM purchases WHERE id = ?',
            [paymentData.purchase_id]
          );

          if (purchase && purchase.balance_amount <= 0) {
            await db.runAsync(
              'UPDATE accounts_payable SET status = ? WHERE purchase_id = ?',
              ['PAID', paymentData.purchase_id]
            );
          } else if (purchase && purchase.balance_amount < purchase.balance_amount + paymentData.amount) {
            await db.runAsync(
              'UPDATE accounts_payable SET status = ? WHERE purchase_id = ?',
              ['PARTIALLY_PAID', paymentData.purchase_id]
            );
          }
        }

        // Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'SYSTEM',
            paymentNumber,
            `Supplier payment - ${paymentNumber}`,
            paymentData.amount,
            paymentData.created_by
          ]
        );

        // Update payment number
        await updatePaymentNumber(db, paymentNumber);
      });

      return { paymentId: paymentId!, paymentNumber };
    } catch (error) {
      console.error('Error creating supplier payment:', error);
      throw error;
    }
  }

  public async getSupplierPayments(supplierId?: number, limit?: number): Promise<any[]> {
    const db = this.getDatabase();

    try {
      let whereClause = '';
      const params: any[] = [];

      if (supplierId) {
        whereClause = 'WHERE sp.supplier_id = ?';
        params.push(supplierId);
      }

      const query = `
        SELECT
          sp.*,
          s.name as supplier_name,
          p.purchase_number,
          u.full_name as created_by_name
        FROM supplier_payments sp
        JOIN suppliers s ON sp.supplier_id = s.id
        LEFT JOIN purchases p ON sp.purchase_id = p.id
        JOIN users u ON sp.created_by = u.id
        ${whereClause}
        ORDER BY sp.payment_date DESC, sp.created_at DESC
        ${limit ? `LIMIT ${limit}` : ''}
      `;

      return await db.getAllAsync(query, params);
    } catch (error) {
      console.error('Error getting supplier payments:', error);
      return [];
    }
  }

  // ========================================
  // ACCOUNTS PAYABLE METHODS
  // ========================================

  public async getAccountsPayable(status?: string): Promise<any[]> {
    const db = this.getDatabase();

    try {
      let whereClause = '';
      const params: any[] = [];

      if (status) {
        whereClause = 'WHERE ap.status = ?';
        params.push(status);
      }

      const query = `
        SELECT
          ap.*,
          p.purchase_number,
          p.reference_number,
          s.name as supplier_name,
          s.contact_person,
          s.phone,
          CASE
            WHEN ap.due_date < date('now') AND ap.balance_amount > 0 THEN 'OVERDUE'
            ELSE ap.status
          END as current_status,
          CAST(julianday('now') - julianday(ap.due_date) AS INTEGER) as days_past_due
        FROM accounts_payable ap
        JOIN purchases p ON ap.purchase_id = p.id
        JOIN suppliers s ON ap.supplier_id = s.id
        ${whereClause}
        ORDER BY ap.due_date ASC, ap.balance_amount DESC
      `;

      return await db.getAllAsync(query, params);
    } catch (error) {
      console.error('Error getting accounts payable:', error);
      return [];
    }
  }

  public async getAccountsPayableAging(): Promise<any> {
    const db = this.getDatabase();

    try {
      const result = await db.getFirstAsync<any>(`
        SELECT
          COUNT(*) as total_invoices,
          SUM(balance_amount) as total_outstanding,
          SUM(CASE WHEN julianday('now') - julianday(due_date) <= 30 THEN balance_amount ELSE 0 END) as current_0_30,
          SUM(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 31 AND 60 THEN balance_amount ELSE 0 END) as aged_31_60,
          SUM(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 61 AND 90 THEN balance_amount ELSE 0 END) as aged_61_90,
          SUM(CASE WHEN julianday('now') - julianday(due_date) > 90 THEN balance_amount ELSE 0 END) as aged_over_90,
          COUNT(CASE WHEN julianday('now') - julianday(due_date) <= 30 THEN 1 END) as count_0_30,
          COUNT(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 31 AND 60 THEN 1 END) as count_31_60,
          COUNT(CASE WHEN julianday('now') - julianday(due_date) BETWEEN 61 AND 90 THEN 1 END) as count_61_90,
          COUNT(CASE WHEN julianday('now') - julianday(due_date) > 90 THEN 1 END) as count_over_90
        FROM accounts_payable
        WHERE balance_amount > 0
      `);

      return result || {
        total_invoices: 0,
        total_outstanding: 0,
        current_0_30: 0,
        aged_31_60: 0,
        aged_61_90: 0,
        aged_over_90: 0,
        count_0_30: 0,
        count_31_60: 0,
        count_61_90: 0,
        count_over_90: 0
      };
    } catch (error) {
      console.error('Error getting accounts payable aging:', error);
      return {
        total_invoices: 0,
        total_outstanding: 0,
        current_0_30: 0,
        aged_31_60: 0,
        aged_61_90: 0,
        aged_over_90: 0,
        count_0_30: 0,
        count_31_60: 0,
        count_61_90: 0,
        count_over_90: 0
      };
    }
  }

  // ========================================
  // DAMAGED ITEMS MANAGEMENT METHODS
  // ========================================

  public async createDamageSession(sessionData: {
    session_name: string;
    notes?: string;
    started_by: number;
  }): Promise<{ sessionId: string; sessionDbId: number }> {
    const db = this.getDatabase();

    try {
      const sessionId = await getNextDamageSessionId(db);

      const result = await db.runAsync(
        `INSERT INTO damaged_items_sessions (session_id, session_name, notes, started_by)
         VALUES (?, ?, ?, ?)`,
        [
          sessionId,
          sessionData.session_name,
          sessionData.notes || null,
          sessionData.started_by
        ]
      );

      await updateDamageSessionNumber(db, sessionId);

      console.log(`Damage session created: ${sessionId} (DB ID: ${result.lastInsertRowId})`);
      return {
        sessionId,
        sessionDbId: result.lastInsertRowId as number
      };
    } catch (error) {
      console.error('Error creating damage session:', error);
      throw error;
    }
  }

  public async getDamageSessions(limit?: number): Promise<any[]> {
    const db = this.getDatabase();

    try {
      const query = `
        SELECT
          ds.*,
          u1.full_name as started_by_name,
          u2.full_name as completed_by_name,
          u3.full_name as cancelled_by_name
        FROM damaged_items_sessions ds
        JOIN users u1 ON ds.started_by = u1.id
        LEFT JOIN users u2 ON ds.completed_by = u2.id
        LEFT JOIN users u3 ON ds.cancelled_by = u3.id
        ORDER BY ds.started_at DESC
        ${limit ? `LIMIT ${limit}` : ''}
      `;

      return await db.getAllAsync(query);
    } catch (error) {
      console.error('Error getting damage sessions:', error);
      return [];
    }
  }

  public async getDamageSessionById(sessionId: string): Promise<any> {
    const db = this.getDatabase();

    try {
      const session = await db.getFirstAsync(
        `SELECT
          ds.*,
          u1.full_name as started_by_name,
          u2.full_name as completed_by_name,
          u3.full_name as cancelled_by_name
        FROM damaged_items_sessions ds
        JOIN users u1 ON ds.started_by = u1.id
        LEFT JOIN users u2 ON ds.completed_by = u2.id
        LEFT JOIN users u3 ON ds.cancelled_by = u3.id
        WHERE ds.session_id = ?`,
        [sessionId]
      );

      if (session) {
        // Get damage details
        const details = await db.getAllAsync(
          `SELECT
            dd.*,
            p.name as current_product_name,
            u.full_name as recorded_by_name
           FROM damaged_items_details dd
           LEFT JOIN products p ON dd.product_id = p.id
           LEFT JOIN users u ON dd.recorded_by = u.id
           WHERE dd.session_id = ?
           ORDER BY dd.recorded_at DESC`,
          [sessionId]
        );

        session.items = details;
      }

      return session;
    } catch (error) {
      console.error(`Error getting damage session ${sessionId}:`, error);
      return null;
    }
  }

  public async addDamagedItem(damageData: {
    session_id: string;
    product_id: number;
    damaged_quantity: number;
    damage_reason: 'EXPIRED' | 'BROKEN' | 'DEFECTIVE' | 'SPOILED' | 'LOST' | 'THEFT' | 'OTHER';
    damage_description?: string;
    recorded_by: number;
  }): Promise<number> {
    const db = this.getDatabase();

    try {
      // Get current product information
      const product = await db.getFirstAsync<any>(
        'SELECT * FROM products WHERE id = ?',
        [damageData.product_id]
      );

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock_quantity < damageData.damaged_quantity) {
        throw new Error('Insufficient stock quantity');
      }

      const totalValue = damageData.damaged_quantity * product.cost;

      let damageDetailId: number;

      await db.withTransactionAsync(async () => {
        // Insert damage detail
        const damageResult = await db.runAsync(
          `INSERT INTO damaged_items_details (
            session_id, product_id, product_code, product_name, current_stock,
            damaged_quantity, unit_cost, total_value, damage_reason,
            damage_description, recorded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            damageData.session_id,
            damageData.product_id,
            product.code,
            product.name,
            product.stock_quantity,
            damageData.damaged_quantity,
            product.cost,
            totalValue,
            damageData.damage_reason,
            damageData.damage_description || null,
            damageData.recorded_by
          ]
        );

        damageDetailId = damageResult.lastInsertRowId as number;

        // Record inventory movement with before/after tracking
        await this.recordInventoryMovement({
          product_id: damageData.product_id,
          movement_type: 'OUT',
          quantity: damageData.damaged_quantity,
          reference_type: 'DAMAGE',
          reference_id: damageDetailId,
          reference_number: damageData.session_id,
          notes: `${damageData.damage_reason} - ${damageData.damage_description || 'No description'}`,
          created_by: damageData.recorded_by
        });

        // Update session totals
        await this.updateDamageSessionTotals(damageData.session_id);

        // Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'SYSTEM',
            damageData.session_id,
            `Damaged item recorded: ${product.name} (${damageData.damaged_quantity} units)`,
            totalValue,
            damageData.recorded_by
          ]
        );
      });

      return damageDetailId!;
    } catch (error) {
      console.error('Error adding damaged item:', error);
      throw error;
    }
  }

  private async updateDamageSessionTotals(sessionId: string): Promise<void> {
    const db = this.getDatabase();

    try {
      const totals = await db.getFirstAsync<{total_items: number, total_value: number}>(
        `SELECT
          COUNT(*) as total_items,
          SUM(total_value) as total_value
         FROM damaged_items_details
         WHERE session_id = ?`,
        [sessionId]
      );

      await db.runAsync(
        'UPDATE damaged_items_sessions SET total_items = ?, total_value = ? WHERE session_id = ?',
        [totals?.total_items || 0, totals?.total_value || 0, sessionId]
      );
    } catch (error) {
      console.error('Error updating damage session totals:', error);
      throw error;
    }
  }

  public async completeDamageSession(sessionId: string, completedBy: number): Promise<void> {
    const db = this.getDatabase();

    try {
      await db.runAsync(
        `UPDATE damaged_items_sessions
         SET status = 'COMPLETED', completed_by = ?, completed_at = CURRENT_TIMESTAMP
         WHERE session_id = ?`,
        [completedBy, sessionId]
      );

      // Add eJournal entry
      await db.runAsync(
        `INSERT INTO ejournal (entry_type, reference_number, description, cashier_id)
         VALUES (?, ?, ?, ?)`,
        [
          'SYSTEM',
          sessionId,
          `Damage session completed - ${sessionId}`,
          completedBy
        ]
      );
    } catch (error) {
      console.error(`Error completing damage session ${sessionId}:`, error);
      throw error;
    }
  }

  public async cancelDamageSession(
    sessionId: string,
    cancelledBy: number,
    reason: string
  ): Promise<void> {
    const db = this.getDatabase();

    try {
      await db.withTransactionAsync(async () => {
        // Get all damaged items in this session
        const damagedItems = await db.getAllAsync<any>(
          'SELECT * FROM damaged_items_details WHERE session_id = ?',
          [sessionId]
        );

        // Restore stock quantities with inventory movement tracking
        for (const item of damagedItems) {
          // Record reverse inventory movement with before/after tracking
          await this.recordInventoryMovement({
            product_id: item.product_id,
            movement_type: 'IN',
            quantity: item.damaged_quantity,
            reference_type: 'DAMAGE_REVERSAL',
            reference_id: item.id,
            reference_number: sessionId,
            notes: `Session cancelled: ${reason}`,
            created_by: cancelledBy
          });
        }

        // Update session status
        await db.runAsync(
          `UPDATE damaged_items_sessions
           SET status = 'CANCELLED', cancelled_by = ?, cancelled_reason = ?
           WHERE session_id = ?`,
          [cancelledBy, reason, sessionId]
        );

        // Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, cashier_id)
           VALUES (?, ?, ?, ?)`,
          [
            'SYSTEM',
            sessionId,
            `Damage session cancelled - ${sessionId}: ${reason}`,
            cancelledBy
          ]
        );
      });
    } catch (error) {
      console.error(`Error cancelling damage session ${sessionId}:`, error);
      throw error;
    }
  }

  public async getDamageReports(dateFrom?: string, dateTo?: string): Promise<any> {
    const db = this.getDatabase();

    try {
      let whereClause = '';
      const params: any[] = [];

      if (dateFrom && dateTo) {
        whereClause = 'WHERE DATE(ds.started_at) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        whereClause = 'WHERE DATE(ds.started_at) >= ?';
        params.push(dateFrom);
      } else if (dateTo) {
        whereClause = 'WHERE DATE(ds.started_at) <= ?';
        params.push(dateTo);
      }

      // Summary by reason
      const reasonSummary = await db.getAllAsync(
        `SELECT
          dd.damage_reason,
          COUNT(*) as item_count,
          SUM(dd.damaged_quantity) as total_quantity,
          SUM(dd.total_value) as total_value
         FROM damaged_items_details dd
         JOIN damaged_items_sessions ds ON dd.session_id = ds.session_id
         ${whereClause}
         GROUP BY dd.damage_reason
         ORDER BY total_value DESC`,
        params
      );

      // Summary by product
      const productSummary = await db.getAllAsync(
        `SELECT
          dd.product_code,
          dd.product_name,
          COUNT(*) as damage_count,
          SUM(dd.damaged_quantity) as total_quantity,
          SUM(dd.total_value) as total_value
         FROM damaged_items_details dd
         JOIN damaged_items_sessions ds ON dd.session_id = ds.session_id
         ${whereClause}
         GROUP BY dd.product_id, dd.product_code, dd.product_name
         ORDER BY total_value DESC
         LIMIT 20`,
        params
      );

      // Overall totals
      const overallTotals = await db.getFirstAsync<any>(
        `SELECT
          COUNT(DISTINCT ds.session_id) as total_sessions,
          COUNT(dd.id) as total_items,
          SUM(dd.damaged_quantity) as total_quantity,
          SUM(dd.total_value) as total_value
         FROM damaged_items_details dd
         JOIN damaged_items_sessions ds ON dd.session_id = ds.session_id
         ${whereClause}`,
        params
      );

      return {
        reasonSummary,
        productSummary,
        overallTotals: overallTotals || {
          total_sessions: 0,
          total_items: 0,
          total_quantity: 0,
          total_value: 0
        }
      };
    } catch (error) {
      console.error('Error getting damage reports:', error);
      return {
        reasonSummary: [],
        productSummary: [],
        overallTotals: {
          total_sessions: 0,
          total_items: 0,
          total_quantity: 0,
          total_value: 0
        }
      };
    }
  }

  // ========================================
  // INVENTORY MOVEMENTS / TRANSACTION HISTORY METHODS
  // ========================================

  public async getInventoryMovements(options?: {
    product_id?: number;
    movement_type?: 'IN' | 'OUT' | 'ADJUSTMENT';
    reference_type?: 'SALE' | 'PURCHASE' | 'MANUAL_ADJUSTMENT' | 'DAMAGE' | 'DAMAGE_REVERSAL' | 'PHYSICAL_COUNT';
    date_from?: string;
    date_to?: string;
    limit?: number;
  }) {
    const db = this.getDatabase();

    try {
      let whereClause = '';
      const params: any[] = [];
      const conditions: string[] = [];

      if (options?.product_id) {
        conditions.push('im.product_id = ?');
        params.push(options.product_id);
      }

      if (options?.movement_type) {
        conditions.push('im.movement_type = ?');
        params.push(options.movement_type);
      }

      if (options?.reference_type) {
        conditions.push('im.reference_type = ?');
        params.push(options.reference_type);
      }

      if (options?.date_from) {
        conditions.push('DATE(im.created_at) >= ?');
        params.push(options.date_from);
      }

      if (options?.date_to) {
        conditions.push('DATE(im.created_at) <= ?');
        params.push(options.date_to);
      }

      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }

      const limit = options?.limit || 100;

      const movements = await db.getAllAsync<any>(
        `SELECT
          im.*,
          u.username as created_by_name,
          p.name as product_name,
          p.code as product_code
         FROM inventory_movements im
         LEFT JOIN users u ON im.created_by = u.id
         LEFT JOIN products p ON im.product_id = p.id
         ${whereClause}
         ORDER BY im.created_at DESC
         LIMIT ?`,
        [...params, limit]
      );

      return movements;
    } catch (error) {
      console.error('Error getting inventory movements:', error);
      return [];
    }
  }

  public async getTransactionHistoryForProduct(productId: number, limit: number = 50) {
    const db = this.getDatabase();

    try {
      const movements = await db.getAllAsync<any>(
        `SELECT
          im.*,
          u.username as created_by_name,
          p.name as product_name,
          p.code as product_code
         FROM inventory_movements im
         LEFT JOIN users u ON im.created_by = u.id
         LEFT JOIN products p ON im.product_id = p.id
         WHERE im.product_id = ?
         ORDER BY im.created_at DESC
         LIMIT ?`,
        [productId, limit]
      );

      return movements;
    } catch (error) {
      console.error('Error getting transaction history for product:', error);
      return [];
    }
  }

  public async getInventoryMovementsSummary(dateFrom?: string, dateTo?: string) {
    const db = this.getDatabase();

    try {
      let whereClause = '';
      const params: any[] = [];

      if (dateFrom && dateTo) {
        whereClause = 'WHERE DATE(im.created_at) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        whereClause = 'WHERE DATE(im.created_at) >= ?';
        params.push(dateFrom);
      } else if (dateTo) {
        whereClause = 'WHERE DATE(im.created_at) <= ?';
        params.push(dateTo);
      }

      // Summary by movement type
      const movementTypeSummary = await db.getAllAsync(
        `SELECT
          movement_type,
          reference_type,
          COUNT(*) as transaction_count,
          SUM(quantity) as total_quantity,
          SUM(total_value) as total_value
         FROM inventory_movements im
         ${whereClause}
         GROUP BY movement_type, reference_type
         ORDER BY total_value DESC`,
        params
      );

      // Summary by product
      const productSummary = await db.getAllAsync(
        `SELECT
          im.product_code,
          im.product_name,
          COUNT(*) as transaction_count,
          SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) as total_in,
          SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) as total_out,
          SUM(total_value) as total_value
         FROM inventory_movements im
         ${whereClause}
         GROUP BY im.product_id, im.product_code, im.product_name
         ORDER BY transaction_count DESC
         LIMIT 20`,
        params
      );

      // Overall totals
      const overallTotals = await db.getFirstAsync<any>(
        `SELECT
          COUNT(*) as total_transactions,
          SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) as total_in_quantity,
          SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) as total_out_quantity,
          SUM(total_value) as total_value
         FROM inventory_movements im
         ${whereClause}`,
        params
      );

      return {
        movementTypeSummary,
        productSummary,
        overallTotals: overallTotals || {
          total_transactions: 0,
          total_in_quantity: 0,
          total_out_quantity: 0,
          total_value: 0
        }
      };
    } catch (error) {
      console.error('Error getting inventory movements summary:', error);
      return {
        movementTypeSummary: [],
        productSummary: [],
        overallTotals: {
          total_transactions: 0,
          total_in_quantity: 0,
          total_out_quantity: 0,
          total_value: 0
        }
      };
    }
  }

  // ========================================
  // CUSTOMER MANAGEMENT METHODS
  // ========================================

  public async createCustomer(customerData: {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    tin?: string;
    credit_terms?: number;
    credit_limit?: number;
    notes?: string;
  }) {
    const db = this.getDatabase();

    try {
      const { getNextCustomerCode, updateCustomerNumber } = await import('./schema');

      const customerCode = await getNextCustomerCode(db);

      const result = await db.runAsync(
        `INSERT INTO customers (
          code, name, contact_person, phone, email, address, tin,
          credit_terms, credit_limit, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerCode,
          customerData.name,
          customerData.contact_person || null,
          customerData.phone || null,
          customerData.email || null,
          customerData.address || null,
          customerData.tin || null,
          customerData.credit_terms || 30,
          customerData.credit_limit || 0,
          customerData.notes || null
        ]
      );

      await updateCustomerNumber(db, customerCode);

      return result.lastInsertRowId as number;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  public async getCustomers(activeOnly: boolean = true) {
    const db = this.getDatabase();

    try {
      const whereClause = activeOnly ? 'WHERE is_active = 1' : '';

      const customers = await db.getAllAsync<any>(
        `SELECT * FROM customers ${whereClause} ORDER BY name ASC`
      );

      return customers;
    } catch (error) {
      console.error('Error getting customers:', error);
      return [];
    }
  }

  public async updateCustomer(id: number, customerData: {
    name?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    tin?: string;
    credit_terms?: number;
    credit_limit?: number;
    is_active?: boolean;
    notes?: string;
  }) {
    const db = this.getDatabase();

    try {
      const setParts = [];
      const values = [];

      Object.entries(customerData).forEach(([key, value]) => {
        if (value !== undefined) {
          setParts.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (setParts.length > 0) {
        setParts.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        await db.runAsync(
          `UPDATE customers SET ${setParts.join(', ')} WHERE id = ?`,
          values
        );
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  // ========================================
  // CUSTOMER PAYMENT METHODS
  // ========================================

  public async processCustomerPayment(paymentData: {
    customer_id?: number;
    transaction_id: number;
    payment_method: 'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' | 'ONLINE';
    amount_paid: number;
    reference_number?: string;
    notes?: string;
    received_by: number;
  }): Promise<number> {
    const db = this.getDatabase();

    try {
      let paymentId: number;

      await db.withTransactionAsync(async () => {
        const { getNextCustomerPaymentNumber, updateCustomerPaymentNumber } = await import('./schema');

        const paymentNumber = await getNextCustomerPaymentNumber(db);

        // Insert customer payment
        const paymentResult = await db.runAsync(
          `INSERT INTO customer_payments (
            payment_number, customer_id, transaction_id, payment_date,
            payment_method, amount_paid, reference_number, notes, received_by
          ) VALUES (?, ?, ?, DATE('now'), ?, ?, ?, ?, ?)`,
          [
            paymentNumber,
            paymentData.customer_id || null,
            paymentData.transaction_id,
            paymentData.payment_method,
            paymentData.amount_paid,
            paymentData.reference_number || null,
            paymentData.notes || null,
            paymentData.received_by
          ]
        );

        paymentId = paymentResult.lastInsertRowId as number;

        // Update accounts receivable
        const arRecord = await db.getFirstAsync<any>(
          'SELECT * FROM accounts_receivable WHERE transaction_id = ?',
          [paymentData.transaction_id]
        );

        if (arRecord) {
          const newPaidAmount = arRecord.paid_amount + paymentData.amount_paid;
          const newBalance = arRecord.original_amount - newPaidAmount;

          let newStatus: string;
          if (newBalance <= 0) {
            newStatus = 'PAID';
          } else if (newPaidAmount > 0) {
            newStatus = 'PARTIALLY_PAID';
          } else {
            newStatus = 'OUTSTANDING';
          }

          await db.runAsync(
            `UPDATE accounts_receivable
             SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE transaction_id = ?`,
            [newPaidAmount, Math.max(0, newBalance), newStatus, paymentData.transaction_id]
          );

          // Update transaction payment status
          await db.runAsync(
            `UPDATE transactions
             SET payment_status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newStatus === 'PAID' ? 'PAID' : 'PARTIAL', paymentData.transaction_id]
          );
        }

        // Update payment number sequence
        await updateCustomerPaymentNumber(db, paymentNumber);

        // Add eJournal entry
        await db.runAsync(
          `INSERT INTO ejournal (entry_type, reference_number, description, amount, cashier_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'PAYMENT',
            paymentNumber,
            `Customer payment received - ${paymentNumber}`,
            paymentData.amount_paid,
            paymentData.received_by
          ]
        );
      });

      return paymentId!;
    } catch (error) {
      console.error('Error processing customer payment:', error);
      throw error;
    }
  }

  public async getCustomerPayments(customerId?: number, limit: number = 50) {
    const db = this.getDatabase();

    try {
      let whereClause = '';
      const params: any[] = [];

      if (customerId) {
        whereClause = 'WHERE cp.customer_id = ?';
        params.push(customerId);
      }

      const payments = await db.getAllAsync<any>(
        `SELECT
          cp.*,
          c.name as customer_name,
          c.code as customer_code,
          t.invoice_number,
          u.username as received_by_name
         FROM customer_payments cp
         LEFT JOIN customers c ON cp.customer_id = c.id
         LEFT JOIN transactions t ON cp.transaction_id = t.id
         LEFT JOIN users u ON cp.received_by = u.id
         ${whereClause}
         ORDER BY cp.payment_date DESC, cp.created_at DESC
         LIMIT ?`,
        [...params, limit]
      );

      return payments;
    } catch (error) {
      console.error('Error getting customer payments:', error);
      return [];
    }
  }

  public async getAccountsReceivable(customerId?: number) {
    const db = this.getDatabase();

    try {
      let whereClause = '';
      const params: any[] = [];

      if (customerId) {
        whereClause = 'WHERE ar.customer_id = ?';
        params.push(customerId);
      }

      const receivables = await db.getAllAsync<any>(
        `SELECT
          ar.*,
          c.name as customer_name,
          c.code as customer_code,
          c.credit_terms
         FROM accounts_receivable ar
         LEFT JOIN customers c ON ar.customer_id = c.id
         ${whereClause}
         ORDER BY ar.due_date ASC, ar.created_at DESC`,
        params
      );

      return receivables;
    } catch (error) {
      console.error('Error getting accounts receivable:', error);
      return [];
    }
  }

  public async getAccountsReceivableAging(asOfDate?: string) {
    const db = this.getDatabase();

    try {
      const dateFilter = asOfDate || 'DATE()';

      // Update aging calculations
      await db.runAsync(
        `UPDATE accounts_receivable
         SET
           days_outstanding = CAST(JULIANDAY(${dateFilter}) - JULIANDAY(invoice_date) AS INTEGER),
           aging_bucket = CASE
             WHEN CAST(JULIANDAY(${dateFilter}) - JULIANDAY(invoice_date) AS INTEGER) <= 30 THEN '0-30'
             WHEN CAST(JULIANDAY(${dateFilter}) - JULIANDAY(invoice_date) AS INTEGER) <= 60 THEN '31-60'
             WHEN CAST(JULIANDAY(${dateFilter}) - JULIANDAY(invoice_date) AS INTEGER) <= 90 THEN '61-90'
             ELSE '90+'
           END,
           updated_at = CURRENT_TIMESTAMP
         WHERE status IN ('OUTSTANDING', 'PARTIALLY_PAID')`
      );

      // Get aging report
      const agingData = await db.getAllAsync<any>(
        `SELECT
          ar.customer_id,
          ar.customer_name,
          c.code as customer_code,
          ar.aging_bucket,
          COUNT(*) as invoice_count,
          SUM(ar.balance_amount) as total_balance
         FROM accounts_receivable ar
         LEFT JOIN customers c ON ar.customer_id = c.id
         WHERE ar.status IN ('OUTSTANDING', 'PARTIALLY_PAID')
         GROUP BY ar.customer_id, ar.customer_name, c.code, ar.aging_bucket
         ORDER BY ar.customer_name, ar.aging_bucket`
      );

      // Get summary totals
      const summaryData = await db.getAllAsync<any>(
        `SELECT
          aging_bucket,
          COUNT(*) as invoice_count,
          SUM(balance_amount) as total_balance
         FROM accounts_receivable
         WHERE status IN ('OUTSTANDING', 'PARTIALLY_PAID')
         GROUP BY aging_bucket
         ORDER BY aging_bucket`
      );

      return {
        agingData,
        summaryData
      };
    } catch (error) {
      console.error('Error getting accounts receivable aging:', error);
      return {
        agingData: [],
        summaryData: []
      };
    }
  }
}