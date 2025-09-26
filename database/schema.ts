import * as SQLite from 'expo-sqlite';

export interface DatabaseSchema {
  // Store configuration and BIR details
  stores: {
    id: number;
    name: string;
    address: string;
    tin: string; // Tax Identification Number for BIR
    bir_permit_number: string;
    pos_machine_serial: string;
    accreditation_number: string;
    created_at: string;
    updated_at: string;
  };

  // Product catalog
  products: {
    id: number;
    code: string;
    name: string;
    description?: string;
    price: number;
    cost: number;
    category_id?: number;
    tax_rate: number; // VAT rate (typically 12% in PH)
    is_vat_inclusive: boolean;
    stock_quantity: number;
    unit: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };

  // Product categories
  categories: {
    id: number;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
  };

  // Sales transactions (BIR compliant)
  transactions: {
    id: number;
    transaction_number: string; // Sequential BIR-compliant numbering
    invoice_number: string; // BIR Invoice number (replaced OR)
    customer_name?: string;
    customer_tin?: string;
    customer_address?: string;
    subtotal: number;
    tax_amount: number; // VAT amount
    discount_amount: number;
    total_amount: number;
    payment_method: 'CASH' | 'CARD' | 'CHECK' | 'ONLINE';
    amount_tendered: number;
    change_amount: number;
    cashier_id: number;
    status: 'COMPLETED' | 'VOID' | 'REFUNDED';
    void_reason?: string;
    void_by?: number;
    void_date?: string;
    transaction_date: string;
    created_at: string;
    updated_at: string;
  };

  // Transaction line items
  transaction_items: {
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
    created_at: string;
  };

  // BIR Z-Reading data (End-of-day reports)
  z_readings: {
    id: number;
    reading_number: number; // Sequential Z-Reading number
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
    reset_counter: number; // Cumulative counter (never resets)
    cashier_id: number;
    created_at: string;
  };

  // BIR X-Reading data (Mid-day inquiry)
  x_readings: {
    id: number;
    date: string;
    time: string;
    current_invoice_number: string;
    gross_sales: number;
    vat_sales: number;
    vat_amount: number;
    vat_exempt_sales: number;
    zero_rated_sales: number;
    discount_amount: number;
    void_amount: number;
    refund_amount: number;
    net_sales: number;
    transaction_count: number;
    cashier_id: number;
    created_at: string;
  };

  // eJournal entries for BIR compliance
  ejournal: {
    id: number;
    transaction_id?: number;
    entry_type: 'SALE' | 'VOID' | 'REFUND' | 'Z_READING' | 'X_READING' | 'SYSTEM';
    reference_number: string;
    description: string;
    amount?: number;
    cashier_id: number;
    timestamp: string;
    created_at: string;
  };

  // Users/Cashiers
  users: {
    id: number;
    username: string;
    full_name: string;
    role: 'ADMIN' | 'CASHIER' | 'MANAGER';
    is_active: boolean;
    password_hash: string;
    last_login?: string;
    created_at: string;
    updated_at: string;
  };

  // Inventory tracking
  inventory_movements: {
    id: number;
    product_id: number;
    movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reference_type: 'SALE' | 'PURCHASE' | 'MANUAL_ADJUSTMENT';
    reference_id?: number;
    notes?: string;
    created_by: number;
    created_at: string;
  };

  // System settings
  settings: {
    id: number;
    key: string;
    value: string;
    description?: string;
    updated_at: string;
  };

  // Physical count sessions for inventory audit trail
  physical_count_sessions: {
    id: number;
    session_id: string;
    date: string;
    started_by: number;
    completed_by?: number;
    status: 'in_progress' | 'completed' | 'cancelled';
    total_items: number;
    counted_items: number;
    discrepancy_count: number;
    total_discrepancy_value: number;
    notes?: string;
    started_at: string;
    completed_at?: string;
    created_at: string;
  };

  // Physical count details for each product in a session
  physical_count_details: {
    id: number;
    session_id: string;
    product_id: number;
    product_code: string;
    product_name: string;
    system_quantity: number;
    physical_quantity: number;
    discrepancy: number;
    unit_cost: number;
    value_discrepancy: number;
    status: 'pending' | 'counted' | 'reviewed';
    counted_by?: number;
    notes?: string;
    counted_at?: string;
    created_at: string;
  };

  // Dynamic role permissions
  role_permissions: {
    id: number;
    role: 'MANAGER' | 'CASHIER';
    permission: string;
    is_enabled: boolean;
    updated_by: number;
    updated_at: string;
  };
}

// Type exports for components
export type Product = DatabaseSchema['products'];
export type Transaction = DatabaseSchema['transactions'];
export type TransactionItem = DatabaseSchema['transaction_items'];
export type Category = DatabaseSchema['categories'];
export type User = DatabaseSchema['users'];
export type InventoryMovement = DatabaseSchema['inventory_movements'];

// Database initialization script
export const initializeDatabase = async (db: SQLite.SQLiteDatabase) => {
  // Enable WAL mode and foreign keys
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      tin TEXT NOT NULL,
      bir_permit_number TEXT NOT NULL,
      pos_machine_serial TEXT NOT NULL,
      accreditation_number TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );
  `);

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

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_number TEXT NOT NULL UNIQUE,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT,
      customer_tin TEXT,
      customer_address TEXT,
      subtotal DECIMAL(10,2) NOT NULL,
      tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      total_amount DECIMAL(10,2) NOT NULL,
      payment_method TEXT CHECK (payment_method IN ('CASH', 'CARD', 'CHECK', 'ONLINE')) DEFAULT 'CASH',
      amount_tendered DECIMAL(10,2) NOT NULL,
      change_amount DECIMAL(10,2) DEFAULT 0,
      cashier_id INTEGER NOT NULL,
      status TEXT CHECK (status IN ('COMPLETED', 'VOID', 'REFUNDED')) DEFAULT 'COMPLETED',
      void_reason TEXT,
      void_by INTEGER,
      void_date DATETIME,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users (id),
      FOREIGN KEY (void_by) REFERENCES users (id)
    );
  `);

  await db.execAsync(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS z_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reading_number INTEGER NOT NULL UNIQUE,
      date DATE NOT NULL,
      start_invoice_number TEXT NOT NULL,
      end_invoice_number TEXT NOT NULL,
      gross_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_exempt_sales DECIMAL(10,2) DEFAULT 0,
      zero_rated_sales DECIMAL(10,2) DEFAULT 0,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      void_amount DECIMAL(10,2) DEFAULT 0,
      refund_amount DECIMAL(10,2) DEFAULT 0,
      net_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
      reset_counter INTEGER NOT NULL DEFAULT 0,
      cashier_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users (id),
      UNIQUE (date)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS x_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      time TIME NOT NULL,
      current_invoice_number TEXT NOT NULL,
      gross_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_exempt_sales DECIMAL(10,2) DEFAULT 0,
      zero_rated_sales DECIMAL(10,2) DEFAULT 0,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      void_amount DECIMAL(10,2) DEFAULT 0,
      refund_amount DECIMAL(10,2) DEFAULT 0,
      net_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
      transaction_count INTEGER DEFAULT 0,
      cashier_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users (id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ejournal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      entry_type TEXT CHECK (entry_type IN ('SALE', 'VOID', 'REFUND', 'Z_READING', 'X_READING', 'SYSTEM')) NOT NULL,
      reference_number TEXT NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(10,2),
      cashier_id INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id),
      FOREIGN KEY (cashier_id) REFERENCES users (id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')) NOT NULL,
      quantity INTEGER NOT NULL,
      reference_type TEXT CHECK (reference_type IN ('SALE', 'PURCHASE', 'MANUAL_ADJUSTMENT')) NOT NULL,
      reference_id INTEGER,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT CHECK (role IN ('MANAGER', 'CASHIER')) NOT NULL,
      permission TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT 1,
      updated_by INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users (id),
      UNIQUE (role, permission)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS physical_count_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      date DATE NOT NULL,
      started_by INTEGER NOT NULL,
      completed_by INTEGER,
      status TEXT CHECK (status IN ('in_progress', 'completed', 'cancelled')) DEFAULT 'in_progress',
      total_items INTEGER NOT NULL DEFAULT 0,
      counted_items INTEGER DEFAULT 0,
      discrepancy_count INTEGER DEFAULT 0,
      total_discrepancy_value DECIMAL(10,2) DEFAULT 0,
      notes TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (started_by) REFERENCES users (id),
      FOREIGN KEY (completed_by) REFERENCES users (id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS physical_count_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      product_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      system_quantity INTEGER NOT NULL,
      physical_quantity INTEGER DEFAULT 0,
      discrepancy INTEGER DEFAULT 0,
      unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      value_discrepancy DECIMAL(10,2) DEFAULT 0,
      status TEXT CHECK (status IN ('pending', 'counted', 'reviewed')) DEFAULT 'pending',
      counted_by INTEGER,
      notes TEXT,
      counted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES physical_count_sessions (session_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (counted_by) REFERENCES users (id)
    );
  `);

  // Create indexes
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions (invoice_number);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items (transaction_id);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_ejournal_timestamp ON ejournal (timestamp);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_products_code ON products (code);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements (product_id);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_role_permissions ON role_permissions (role, permission);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_physical_count_sessions_date ON physical_count_sessions (date);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_physical_count_sessions_user ON physical_count_sessions (started_by);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_physical_count_details_session ON physical_count_details (session_id);');
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_physical_count_details_user ON physical_count_details (counted_by);');

  // Insert default settings
  await db.execAsync(`
    INSERT OR IGNORE INTO settings (key, value, description) VALUES
      ('company_name', 'Your Company Name', 'Company name for receipts'),
      ('company_address', 'Your Company Address', 'Company address for receipts'),
      ('company_tin', '000-000-000-000', 'Company TIN for BIR compliance'),
      ('bir_permit', 'FP-000000000-000', 'BIR Permit Number'),
      ('pos_serial', 'POS000000', 'POS Machine Serial Number'),
      ('accreditation_number', 'ACC000000', 'BIR Accreditation Number'),
      ('vat_rate', '12.00', 'VAT rate percentage'),
      ('receipt_footer', 'Thank you for your business!', 'Receipt footer message'),
      ('z_counter', '0', 'Z-Reading counter (cumulative)'),
      ('current_invoice_series', 'INV', 'Current invoice series prefix'),
      ('current_invoice_number', '1', 'Current invoice number');
  `);

  // Insert default users
  await db.execAsync(`
    INSERT OR IGNORE INTO users (username, full_name, role, password_hash) VALUES
      ('admin', 'System Administrator', 'ADMIN', '$2b$10$demo_hash_admin'),
      ('manager', 'Store Manager', 'MANAGER', '$2b$10$demo_hash_manager'),
      ('cashier', 'Cashier User', 'CASHIER', '$2b$10$demo_hash_cashier');
  `);

  // Insert default role permissions for MANAGER
  const managerPermissions = [
    'VIEW_DASHBOARD', 'CREATE_SALE', 'VIEW_ALL_SALES', 'VIEW_OWN_SALES',
    'VOID_SALE', 'REFUND_SALE', 'MANAGE_PRODUCTS', 'VIEW_PRODUCTS',
    'MANAGE_INVENTORY', 'VIEW_REPORTS', 'VIEW_SETTINGS', 'PERFORM_Z_READING',
    'PERFORM_X_READING', 'VIEW_EJOURNAL', 'MANAGE_PURCHASES'
  ];

  for (const permission of managerPermissions) {
    await db.execAsync(`
      INSERT OR IGNORE INTO role_permissions (role, permission, is_enabled, updated_by)
      VALUES ('MANAGER', '${permission}', 1, 1);
    `);
  }

  // Insert default role permissions for CASHIER
  const cashierPermissions = [
    { permission: 'VIEW_DASHBOARD', enabled: 1 },
    { permission: 'CREATE_SALE', enabled: 1 },
    { permission: 'VIEW_ALL_SALES', enabled: 0 },
    { permission: 'VIEW_OWN_SALES', enabled: 1 },
    { permission: 'VOID_SALE', enabled: 0 },
    { permission: 'REFUND_SALE', enabled: 0 },
    { permission: 'MANAGE_PRODUCTS', enabled: 0 },
    { permission: 'VIEW_PRODUCTS', enabled: 1 },
    { permission: 'MANAGE_INVENTORY', enabled: 0 },
    { permission: 'VIEW_REPORTS', enabled: 0 },
    { permission: 'VIEW_SETTINGS', enabled: 0 },
    { permission: 'PERFORM_Z_READING', enabled: 0 },
    { permission: 'PERFORM_X_READING', enabled: 0 },
    { permission: 'VIEW_EJOURNAL', enabled: 0 },
    { permission: 'MANAGE_PURCHASES', enabled: 0 }
  ];

  for (const { permission, enabled } of cashierPermissions) {
    await db.execAsync(`
      INSERT OR IGNORE INTO role_permissions (role, permission, is_enabled, updated_by)
      VALUES ('CASHIER', '${permission}', ${enabled}, 1);
    `);
  }
};

export const getNextInvoiceNumber = async (db: SQLite.SQLiteDatabase): Promise<string> => {
  const result = await db.getFirstAsync<{value: string, series: string}>(
    `SELECT
       (SELECT value FROM settings WHERE key = 'current_invoice_number') as value,
       (SELECT value FROM settings WHERE key = 'current_invoice_series') as series`
  );

  if (!result) {
    throw new Error('Invoice settings not found');
  }

  const nextNumber = (parseInt(result.value) + 1).toString().padStart(8, '0');
  return `${result.series}${nextNumber}`;
};

export const updateInvoiceNumber = async (db: SQLite.SQLiteDatabase, invoiceNumber: string) => {
  const numericPart = invoiceNumber.replace(/^\D+/, '');
  await db.runAsync(
    'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
    [numericPart, 'current_invoice_number']
  );
};