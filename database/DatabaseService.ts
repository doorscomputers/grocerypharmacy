import * as SQLite from 'expo-sqlite';
import { initializeDatabase, getNextInvoiceNumber, updateInvoiceNumber } from './schema';

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
      this.db = await SQLite.openDatabaseAsync('pos_database.db');
      await initializeDatabase(this.db);
    }
  }

  public getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
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
  }) {
    const db = this.getDatabase();
    try {
      const result = await db.runAsync(
        `INSERT OR REPLACE INTO products (code, name, description, price, cost, category_id, tax_rate, is_vat_inclusive, stock_quantity, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          product.unit || 'pcs'
        ]
      );
      console.log(`Product created: ${product.name} (ID: ${result.lastInsertRowId})`);
      return result.lastInsertRowId;
    } catch (error) {
      console.error(`Error creating product ${product.name}:`, error);
      throw error;
    }
  }

  public async getProducts(active_only: boolean = true) {
    const db = this.getDatabase();
    try {
      const whereClause = active_only ? 'WHERE p.is_active = 1' : '';
      const products = await db.getAllAsync(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereClause}
         ORDER BY p.name`
      );
      console.log(`DatabaseService.getProducts: Found ${products.length} products`);
      console.log(`Query used: SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause} ORDER BY p.name`);
      if (products.length > 0) {
        console.log('Sample product:', JSON.stringify(products[0], null, 2));
      }
      return products;
    } catch (error) {
      console.error('Error in getProducts:', error);
      // Fallback to simpler query if JOIN fails
      try {
        const simpleProducts = await db.getAllAsync(
          `SELECT * FROM products ${active_only ? 'WHERE is_active = 1' : ''} ORDER BY name`
        );
        console.log(`Fallback query returned ${simpleProducts.length} products`);
        return simpleProducts;
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        return [];
      }
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

    await db.withTransactionAsync(async () => {
      // Create transaction
      const transactionResult = await db.runAsync(
        `INSERT INTO transactions (
          transaction_number, invoice_number, customer_name, customer_tin, customer_address,
          subtotal, tax_amount, discount_amount, total_amount, payment_method,
          amount_tendered, change_amount, cashier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

        // Update product stock
        await db.runAsync(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );

        // Record inventory movement
        await db.runAsync(
          `INSERT INTO inventory_movements (
            product_id, movement_type, quantity, reference_type, reference_id, created_by
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [item.product_id, 'OUT', item.quantity, 'SALE', transactionId, transaction.cashier_id]
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
    return await db.getFirstAsync(
      'SELECT id, username, full_name, role, is_active FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
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
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (sessionId) {
      whereClause += ' AND pcs.session_id = ?';
      params.push(sessionId);
    }
    if (startDate) {
      whereClause += ' AND pcs.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND pcs.date <= ?';
      params.push(endDate);
    }

    const query = `
      SELECT
        pcs.session_id,
        pcs.date,
        pcs.status,
        u1.full_name as started_by_name,
        u2.full_name as completed_by_name,
        pcs.started_at,
        pcs.completed_at,
        pcs.total_items,
        pcs.counted_items,
        pcs.discrepancy_count,
        pcs.total_discrepancy_value,
        pcs.notes,
        pcd.product_code,
        pcd.product_name,
        pcd.system_quantity,
        pcd.physical_quantity,
        pcd.discrepancy,
        pcd.value_discrepancy,
        pcd.status as item_status,
        u3.full_name as counted_by_name,
        pcd.counted_at,
        pcd.notes as item_notes
      FROM physical_count_sessions pcs
      LEFT JOIN users u1 ON pcs.started_by = u1.id
      LEFT JOIN users u2 ON pcs.completed_by = u2.id
      LEFT JOIN physical_count_details pcd ON pcs.session_id = pcd.session_id
      LEFT JOIN users u3 ON pcd.counted_by = u3.id
      ${whereClause}
      ORDER BY pcs.date DESC, pcs.session_id, pcd.product_name
    `;

    return await db.getAllAsync(query, params);
  }
}