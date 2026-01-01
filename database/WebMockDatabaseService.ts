/**
 * WebMockDatabaseService - In-memory mock database for web testing
 * This allows testing UI/UX in web browser without SQLite
 * Data persists to localStorage for browser refresh/close survival
 */

import { Category, Brand, Unit, Size, Supplier } from './schema';

const STORAGE_KEY = 'posmobile_webmock_db';

// In-memory data stores
let products: any[] = [];
let categories: Category[] = [];
let brands: Brand[] = [];
let units: Unit[] = [];
let sizes: Size[] = [];
let transactions: any[] = [];
let users: any[] = [];
let suppliers: Supplier[] = [];
let customers: any[] = [];
let settings: Record<string, string> = {};
let inventoryMovements: any[] = [];
let physicalCountSessions: any[] = [];
let physicalCountDetails: any[] = [];
let damageSessions: any[] = [];
let damageDetails: any[] = [];
let purchases: any[] = [];
let purchaseItems: any[] = [];
let accountsReceivable: any[] = [];
let accountsPayable: any[] = [];
let customerPayments: any[] = [];
let supplierPayments: any[] = [];
let eJournalEntries: any[] = [];
let salesReturns: any[] = [];
let salesReturnItems: any[] = [];
let purchaseReturns: any[] = [];
let purchaseReturnItems: any[] = [];
let endOfDayRecords: any[] = [];

// Auto-increment counters
let productIdCounter = 1;
let categoryIdCounter = 1;
let brandIdCounter = 1;
let unitIdCounter = 1;
let sizeIdCounter = 1;
let transactionIdCounter = 1;
let supplierIdCounter = 1;
let customerIdCounter = 1;
let inventoryMovementIdCounter = 1;
let physicalCountDetailIdCounter = 1;
let damageSessionIdCounter = 1;
let damageDetailIdCounter = 1;
let purchaseIdCounter = 1;
let purchaseItemIdCounter = 1;
let arIdCounter = 1;
let apIdCounter = 1;
let customerPaymentIdCounter = 1;
let supplierPaymentIdCounter = 1;
let eJournalIdCounter = 1;
let salesReturnIdCounter = 1;
let salesReturnItemIdCounter = 1;
let purchaseReturnIdCounter = 1;
let purchaseReturnItemIdCounter = 1;
let eodIdCounter = 1;

// Save all data to localStorage
function saveToLocalStorage() {
  try {
    const data = {
      products,
      categories,
      brands,
      units,
      sizes,
      transactions,
      users,
      suppliers,
      customers,
      settings,
      inventoryMovements,
      physicalCountSessions,
      physicalCountDetails,
      damageSessions,
      damageDetails,
      purchases,
      purchaseItems,
      accountsReceivable,
      accountsPayable,
      customerPayments,
      supplierPayments,
      eJournalEntries,
      salesReturns,
      salesReturnItems,
      purchaseReturns,
      purchaseReturnItems,
      endOfDayRecords,
      counters: {
        productIdCounter,
        categoryIdCounter,
        brandIdCounter,
        unitIdCounter,
        sizeIdCounter,
        transactionIdCounter,
        supplierIdCounter,
        customerIdCounter,
        inventoryMovementIdCounter,
        physicalCountDetailIdCounter,
        damageSessionIdCounter,
        damageDetailIdCounter,
        purchaseIdCounter,
        purchaseItemIdCounter,
        arIdCounter,
        apIdCounter,
        customerPaymentIdCounter,
        supplierPaymentIdCounter,
        eJournalIdCounter,
        salesReturnIdCounter,
        salesReturnItemIdCounter,
        purchaseReturnIdCounter,
        purchaseReturnItemIdCounter,
        eodIdCounter,
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('[WebMock] Data saved to localStorage');
  } catch (e) {
    console.error('[WebMock] Failed to save to localStorage:', e);
  }
}

// Load data from localStorage
function loadFromLocalStorage(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      products = data.products || [];
      categories = data.categories || [];
      brands = data.brands || [];
      units = data.units || [];
      sizes = data.sizes || [];
      transactions = data.transactions || [];
      users = data.users || [];
      suppliers = data.suppliers || [];
      customers = data.customers || [];
      settings = data.settings || {};
      inventoryMovements = data.inventoryMovements || [];
      physicalCountSessions = data.physicalCountSessions || [];
      physicalCountDetails = data.physicalCountDetails || [];
      damageSessions = data.damageSessions || [];
      damageDetails = data.damageDetails || [];
      purchases = data.purchases || [];
      purchaseItems = data.purchaseItems || [];
      accountsReceivable = data.accountsReceivable || [];
      accountsPayable = data.accountsPayable || [];
      customerPayments = data.customerPayments || [];
      supplierPayments = data.supplierPayments || [];
      eJournalEntries = data.eJournalEntries || [];
      salesReturns = data.salesReturns || [];
      salesReturnItems = data.salesReturnItems || [];
      purchaseReturns = data.purchaseReturns || [];
      purchaseReturnItems = data.purchaseReturnItems || [];
      endOfDayRecords = data.endOfDayRecords || [];

      if (data.counters) {
        productIdCounter = data.counters.productIdCounter || 1;
        categoryIdCounter = data.counters.categoryIdCounter || 1;
        brandIdCounter = data.counters.brandIdCounter || 1;
        unitIdCounter = data.counters.unitIdCounter || 1;
        sizeIdCounter = data.counters.sizeIdCounter || 1;
        transactionIdCounter = data.counters.transactionIdCounter || 1;
        supplierIdCounter = data.counters.supplierIdCounter || 1;
        customerIdCounter = data.counters.customerIdCounter || 1;
        inventoryMovementIdCounter = data.counters.inventoryMovementIdCounter || 1;
        physicalCountDetailIdCounter = data.counters.physicalCountDetailIdCounter || 1;
        damageSessionIdCounter = data.counters.damageSessionIdCounter || 1;
        damageDetailIdCounter = data.counters.damageDetailIdCounter || 1;
        purchaseIdCounter = data.counters.purchaseIdCounter || 1;
        purchaseItemIdCounter = data.counters.purchaseItemIdCounter || 1;
        arIdCounter = data.counters.arIdCounter || 1;
        apIdCounter = data.counters.apIdCounter || 1;
        customerPaymentIdCounter = data.counters.customerPaymentIdCounter || 1;
        supplierPaymentIdCounter = data.counters.supplierPaymentIdCounter || 1;
        eJournalIdCounter = data.counters.eJournalIdCounter || 1;
        salesReturnIdCounter = data.counters.salesReturnIdCounter || 1;
        salesReturnItemIdCounter = data.counters.salesReturnItemIdCounter || 1;
        purchaseReturnIdCounter = data.counters.purchaseReturnIdCounter || 1;
        purchaseReturnItemIdCounter = data.counters.purchaseReturnItemIdCounter || 1;
        eodIdCounter = data.counters.eodIdCounter || 1;
      }
      console.log('[WebMock] Data loaded from localStorage');
      return true;
    }
  } catch (e) {
    console.error('[WebMock] Failed to load from localStorage:', e);
  }
  return false;
}

// Initialize with sample data
function initializeSampleData() {
  // Categories
  categories = [
    { id: 1, name: 'Beverages', description: 'Drinks and beverages', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: 'Food', description: 'Food items', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 3, name: 'Snacks', description: 'Snack items', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 4, name: 'Personal Care', description: 'Personal care products', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  categoryIdCounter = 5;

  // Brands
  brands = [
    { id: 1, name: 'Coca-Cola', description: 'Coca-Cola Company', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: 'Nestle', description: 'Nestle Philippines', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 3, name: 'San Miguel', description: 'San Miguel Corporation', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 4, name: 'Universal Robina', description: 'URC', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  brandIdCounter = 5;

  // Units
  units = [
    { id: 1, name: 'Piece', abbreviation: 'pc', description: 'Single piece', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: 'Box', abbreviation: 'box', description: 'Box', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 3, name: 'Pack', abbreviation: 'pk', description: 'Pack', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 4, name: 'Kilogram', abbreviation: 'kg', description: 'Kilogram', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 5, name: 'Liter', abbreviation: 'L', description: 'Liter', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  unitIdCounter = 6;

  // Sizes
  sizes = [
    { id: 1, name: 'Small', description: 'Small size', sort_order: 1, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: 'Medium', description: 'Medium size', sort_order: 2, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 3, name: 'Large', description: 'Large size', sort_order: 3, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 4, name: '500ml', description: '500 milliliters', sort_order: 4, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 5, name: '1L', description: '1 Liter', sort_order: 5, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  sizeIdCounter = 6;

  // Products - include all field variants for compatibility
  products = [
    { id: 1, code: 'COKE500', barcode: '4801234567890', name: 'Coca-Cola 500ml', description: 'Coca-Cola Regular 500ml', category_id: 1, brand_id: 1, unit_id: 1, size_id: 4, cost: 25.00, cost_price: 25.00, selling_price: 35.00, price: 35.00, stock_quantity: 100, reorder_level: 20, tax_rate: 12, is_vatable: 1, is_vat_inclusive: true, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), category_name: 'Beverages', brand_name: 'Coca-Cola', unit_name: 'Piece', unit_abbreviation: 'pc', size_name: '500ml' },
    { id: 2, code: 'SPRITE1L', barcode: '4801234567891', name: 'Sprite 1L', description: 'Sprite 1 Liter', category_id: 1, brand_id: 1, unit_id: 1, size_id: 5, cost: 40.00, cost_price: 40.00, selling_price: 55.00, price: 55.00, stock_quantity: 80, reorder_level: 15, tax_rate: 12, is_vatable: 1, is_vat_inclusive: true, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), category_name: 'Beverages', brand_name: 'Coca-Cola', unit_name: 'Piece', unit_abbreviation: 'pc', size_name: '1L' },
    { id: 3, code: 'NESCAFE3N1', barcode: '4801234567892', name: 'Nescafe 3-in-1', description: 'Nescafe 3-in-1 Coffee', category_id: 1, brand_id: 2, unit_id: 3, size_id: 1, cost: 8.00, cost_price: 8.00, selling_price: 12.00, price: 12.00, stock_quantity: 200, reorder_level: 50, tax_rate: 12, is_vatable: 1, is_vat_inclusive: true, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), category_name: 'Beverages', brand_name: 'Nestle', unit_name: 'Pack', unit_abbreviation: 'pk', size_name: 'Small' },
    { id: 4, code: 'LMPANCIT', barcode: '4801234567893', name: 'Lucky Me Pancit Canton', description: 'Lucky Me Instant Noodles', category_id: 2, brand_id: 2, unit_id: 3, size_id: 2, cost: 10.00, cost_price: 10.00, selling_price: 15.00, price: 15.00, stock_quantity: 150, reorder_level: 30, tax_rate: 12, is_vatable: 1, is_vat_inclusive: true, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), category_name: 'Food', brand_name: 'Nestle', unit_name: 'Pack', unit_abbreviation: 'pk', size_name: 'Medium' },
    { id: 5, code: 'C2APPLE', barcode: '4801234567894', name: 'C2 Apple', description: 'C2 Apple Green Tea', category_id: 1, brand_id: 4, unit_id: 1, size_id: 4, cost: 15.00, cost_price: 15.00, selling_price: 22.00, price: 22.00, stock_quantity: 120, reorder_level: 25, tax_rate: 12, is_vatable: 1, is_vat_inclusive: true, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), category_name: 'Beverages', brand_name: 'Universal Robina', unit_name: 'Piece', unit_abbreviation: 'pc', size_name: '500ml' },
  ];
  productIdCounter = 6;

  // Users - is_active must be boolean true for TypeScript User type
  users = [
    { id: 1, username: 'admin', password_hash: 'admin123', role: 'ADMIN', full_name: 'Administrator', is_active: true, created_at: new Date().toISOString() },
    { id: 2, username: 'cashier', password_hash: 'cashier123', role: 'CASHIER', full_name: 'Cashier User', is_active: true, created_at: new Date().toISOString() },
    { id: 3, username: 'manager', password_hash: 'manager123', role: 'MANAGER', full_name: 'Manager User', is_active: true, created_at: new Date().toISOString() },
  ];

  // Suppliers
  suppliers = [
    { id: 1, name: 'ABC Distributors', contact_person: 'Juan Dela Cruz', phone: '09171234567', email: 'abc@email.com', address: 'Manila, Philippines', tin: '123-456-789-000', credit_limit: 50000, payment_terms: 30, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: 'XYZ Trading', contact_person: 'Maria Santos', phone: '09189876543', email: 'xyz@email.com', address: 'Quezon City, Philippines', tin: '987-654-321-000', credit_limit: 100000, payment_terms: 45, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  supplierIdCounter = 3;

  // Customers
  customers = [
    { id: 1, name: 'Walk-in Customer', phone: '', email: '', address: '', tin: '', credit_limit: 0, is_active: 1, created_at: new Date().toISOString() },
  ];
  customerIdCounter = 2;

  // Settings
  settings = {
    'company_name': 'IgoroTech POS',
    'company_address': 'Baguio City, Philippines',
    'company_tin': '000-000-000-000',
    'vat_rate': '12.00',
    'pos_serial': 'POS000001',
    'receipt_footer': 'Thank you for your business!',
  };
}

export class WebMockDatabaseService {
  private static instance: WebMockDatabaseService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): WebMockDatabaseService {
    if (!WebMockDatabaseService.instance) {
      WebMockDatabaseService.instance = new WebMockDatabaseService();
    }
    return WebMockDatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (!this.initialized) {
      console.log('[WebMock] Initializing mock database for web testing...');

      // Try to load from localStorage first
      const loaded = loadFromLocalStorage();
      if (!loaded) {
        // No stored data, use sample data
        initializeSampleData();
        saveToLocalStorage(); // Save initial data
      }

      this.initialized = true;
      console.log('[WebMock] Mock database initialized (localStorage persistence enabled)');
    }
  }

  // Method to clear all data and reset to sample data
  public async resetToSampleData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    initializeSampleData();
    saveToLocalStorage();
    console.log('[WebMock] Database reset to sample data');
  }

  // ============ PRODUCTS ============
  public async getProducts(activeOnly: boolean = true, limit?: number, searchTerm?: string): Promise<any[]> {
    // This now supports search functionality used by PhysicalInventoryScreen
    return this.getProductsWithDetails(activeOnly, limit, searchTerm);
  }

  public async getProductsWithDetails(activeOnly: boolean = true, limit?: number, searchTerm?: string): Promise<any[]> {
    // Handle both is_active === 1 and is_active === true
    let result = activeOnly ? products.filter(p => p.is_active === 1 || p.is_active === true) : [...products];

    // Apply search filter
    if (searchTerm && searchTerm.trim() !== '') {
      const search = searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.barcode && p.barcode.toLowerCase().includes(search)) ||
        (p.code && p.code.toLowerCase().includes(search)) ||
        (p.description && p.description.toLowerCase().includes(search)) ||
        (p.category_name && p.category_name.toLowerCase().includes(search)) ||
        (p.brand_name && p.brand_name.toLowerCase().includes(search))
      );
    }

    // Apply limit
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }

    return result;
  }

  public async getProductById(id: number): Promise<any | null> {
    return products.find(p => p.id === id) || null;
  }

  public async getProductByBarcode(barcode: string): Promise<any | null> {
    return products.find(p => p.barcode === barcode) || null;
  }

  public async createProduct(product: any): Promise<number> {
    // Add related names
    const category = categories.find(c => c.id === product.category_id);
    const brand = brands.find(b => b.id === product.brand_id);
    const unit = units.find(u => u.id === product.unit_id);
    const size = sizes.find(s => s.id === product.size_id);

    const newProduct = {
      ...product,
      id: productIdCounter++,
      // Ensure both price variants exist
      price: product.price || product.selling_price || 0,
      selling_price: product.selling_price || product.price || 0,
      cost: product.cost || product.cost_price || 0,
      cost_price: product.cost_price || product.cost || 0,
      barcode: product.barcode || product.code || '',
      is_active: product.is_active ?? 1,
      is_vat_inclusive: product.is_vat_inclusive ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category_name: category?.name || '',
      brand_name: brand?.name || '',
      unit_name: unit?.name || '',
      unit_abbreviation: unit?.abbreviation || '',
      size_name: size?.name || '',
    };

    products.push(newProduct);
    saveToLocalStorage();
    console.log('[WebMock] Created product:', newProduct.name, 'Total products:', products.length);
    return newProduct.id;
  }

  public async createProductWithDetails(product: any): Promise<number> {
    return this.createProduct(product);
  }

  public async updateProduct(id: number, product: any): Promise<void> {
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      const category = categories.find(c => c.id === product.category_id);
      const brand = brands.find(b => b.id === product.brand_id);
      const unit = units.find(u => u.id === product.unit_id);
      const size = sizes.find(s => s.id === product.size_id);
      products[index] = {
        ...products[index],
        ...product,
        category_name: category?.name || '',
        brand_name: brand?.name || '',
        unit_name: unit?.name || '',
        unit_abbreviation: unit?.abbreviation || '',
        size_name: size?.name || '',
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
    }
  }

  public async updateProductWithDetails(id: number, product: any): Promise<void> {
    return this.updateProduct(id, product);
  }

  public async deleteProduct(id: number): Promise<void> {
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index].is_active = 0;
      saveToLocalStorage();
    }
  }

  public async updateProductStock(id: number, quantity: number): Promise<void> {
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index].stock_quantity = quantity;
      saveToLocalStorage();
    }
  }

  // ============ CATEGORIES ============
  public async getCategories(activeOnly: boolean = true): Promise<Category[]> {
    if (activeOnly) {
      return categories.filter(c => c.is_active === 1 || c.is_active === true);
    }
    return [...categories];
  }

  public async getCategoryById(id: number): Promise<Category | null> {
    return categories.find(c => c.id === id) || null;
  }

  public async createCategory(category: Partial<Category>): Promise<number> {
    const newCategory: Category = {
      id: categoryIdCounter++,
      name: category.name || '',
      description: category.description || '',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    categories.push(newCategory);
    saveToLocalStorage();
    return newCategory.id;
  }

  public async updateCategory(id: number, category: Partial<Category>): Promise<void> {
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = {
        ...categories[index],
        ...category,
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
    }
  }

  public async deleteCategory(id: number): Promise<void> {
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index].is_active = 0;
      saveToLocalStorage();
    }
  }

  // ============ BRANDS ============
  public async getBrands(activeOnly: boolean = true): Promise<Brand[]> {
    if (activeOnly) {
      return brands.filter(b => b.is_active === 1 || b.is_active === true);
    }
    return [...brands];
  }

  public async getBrandById(id: number): Promise<Brand | null> {
    return brands.find(b => b.id === id) || null;
  }

  public async createBrand(brand: Partial<Brand>): Promise<number> {
    const newBrand: Brand = {
      id: brandIdCounter++,
      name: brand.name || '',
      description: brand.description || '',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    brands.push(newBrand);
    saveToLocalStorage();
    return newBrand.id;
  }

  public async updateBrand(id: number, brand: Partial<Brand>): Promise<void> {
    const index = brands.findIndex(b => b.id === id);
    if (index !== -1) {
      brands[index] = {
        ...brands[index],
        ...brand,
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
    }
  }

  public async deleteBrand(id: number): Promise<void> {
    const index = brands.findIndex(b => b.id === id);
    if (index !== -1) {
      brands[index].is_active = 0;
      saveToLocalStorage();
    }
  }

  // ============ UNITS ============
  public async getUnits(activeOnly: boolean = true): Promise<Unit[]> {
    if (activeOnly) {
      return units.filter(u => u.is_active === 1 || u.is_active === true);
    }
    return [...units];
  }

  public async getUnitById(id: number): Promise<Unit | null> {
    return units.find(u => u.id === id) || null;
  }

  public async createUnit(unit: Partial<Unit>): Promise<number> {
    const newUnit: Unit = {
      id: unitIdCounter++,
      name: unit.name || '',
      abbreviation: unit.abbreviation || '',
      description: unit.description || '',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    units.push(newUnit);
    saveToLocalStorage();
    return newUnit.id;
  }

  public async updateUnit(id: number, unit: Partial<Unit>): Promise<void> {
    const index = units.findIndex(u => u.id === id);
    if (index !== -1) {
      units[index] = {
        ...units[index],
        ...unit,
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
    }
  }

  public async deleteUnit(id: number): Promise<void> {
    const index = units.findIndex(u => u.id === id);
    if (index !== -1) {
      units[index].is_active = 0;
      saveToLocalStorage();
    }
  }

  // ============ SIZES ============
  public async getSizes(activeOnly: boolean = true): Promise<Size[]> {
    if (activeOnly) {
      return sizes.filter(s => s.is_active === 1 || s.is_active === true);
    }
    return [...sizes];
  }

  public async getSizeById(id: number): Promise<Size | null> {
    return sizes.find(s => s.id === id) || null;
  }

  public async createSize(size: Partial<Size>): Promise<number> {
    const newSize: Size = {
      id: sizeIdCounter++,
      name: size.name || '',
      description: size.description || '',
      sort_order: size.sort_order || sizes.length + 1,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sizes.push(newSize);
    saveToLocalStorage();
    return newSize.id;
  }

  public async updateSize(id: number, size: Partial<Size>): Promise<void> {
    const index = sizes.findIndex(s => s.id === id);
    if (index !== -1) {
      sizes[index] = {
        ...sizes[index],
        ...size,
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
    }
  }

  public async deleteSize(id: number): Promise<void> {
    const index = sizes.findIndex(s => s.id === id);
    if (index !== -1) {
      sizes[index].is_active = 0;
      saveToLocalStorage();
    }
  }

  // ============ USERS ============
  public async getUsers(): Promise<any[]> {
    return users.filter(u => u.is_active === 1);
  }

  public async getUserByUsername(username: string): Promise<any | null> {
    return users.find(u => u.username === username && u.is_active) || null;
  }

  public async validateUser(username: string, password: string): Promise<any | null> {
    // For web mock, accept any password
    const user = users.find(u => u.username === username && u.is_active);
    console.log('[WebMock] validateUser:', username, 'found:', user?.username, 'role:', user?.role, 'is_active:', user?.is_active);
    return user || null;
  }

  // Alias for authenticateUser (used by AuthContext)
  public async authenticateUser(username: string, password: string): Promise<any | null> {
    return this.validateUser(username, password);
  }

  // ============ SUPPLIERS ============
  public async getSuppliers(activeOnly: boolean = true): Promise<any[]> {
    if (activeOnly) {
      return suppliers.filter(s => s.is_active === 1);
    }
    return [...suppliers];
  }

  public async getSupplierById(id: number): Promise<Supplier | null> {
    return suppliers.find(s => s.id === id) || null;
  }

  public async createSupplier(supplier: any): Promise<number> {
    const code = `SUP${String(supplierIdCounter).padStart(3, '0')}`;
    const newSupplier: any = {
      id: supplierIdCounter++,
      code: supplier.code || code,
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      tin: supplier.tin || '',
      credit_limit: supplier.credit_limit || 0,
      credit_terms: supplier.credit_terms || 30,
      payment_terms: supplier.payment_terms || 30,
      notes: supplier.notes || '',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    suppliers.push(newSupplier as Supplier);
    saveToLocalStorage();
    console.log('[WebMock] Created supplier:', newSupplier.name);
    return newSupplier.id;
  }

  public async updateSupplier(id: number, supplier: any): Promise<void> {
    const index = suppliers.findIndex(s => s.id === id);
    if (index !== -1) {
      suppliers[index] = {
        ...suppliers[index],
        ...supplier,
        updated_at: new Date().toISOString(),
      } as Supplier;
      saveToLocalStorage();
      console.log('[WebMock] Updated supplier:', suppliers[index].name);
    }
  }

  public async deleteSupplier(id: number): Promise<void> {
    const index = suppliers.findIndex(s => s.id === id);
    if (index !== -1) {
      (suppliers[index] as any).is_active = 0;
      saveToLocalStorage();
    }
  }

  // ============ CUSTOMERS ============
  public async getCustomers(activeOnly: boolean = true): Promise<any[]> {
    if (activeOnly) {
      return customers.filter(c => c.is_active === 1);
    }
    return [...customers];
  }

  public async getCustomerById(id: number): Promise<any | null> {
    return customers.find(c => c.id === id) || null;
  }

  public async createCustomer(customer: any): Promise<number> {
    const code = `CUST${String(customerIdCounter).padStart(3, '0')}`;
    const newCustomer = {
      id: customerIdCounter++,
      code: customer.code || code,
      name: customer.name || '',
      contact_person: customer.contact_person || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      tin: customer.tin || '',
      credit_limit: customer.credit_limit || 0,
      credit_terms: customer.credit_terms || 30,
      notes: customer.notes || '',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    customers.push(newCustomer);
    saveToLocalStorage();
    console.log('[WebMock] Created customer:', newCustomer.name);
    return newCustomer.id;
  }

  public async updateCustomer(id: number, customer: any): Promise<void> {
    const index = customers.findIndex(c => c.id === id);
    if (index !== -1) {
      customers[index] = {
        ...customers[index],
        ...customer,
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
      console.log('[WebMock] Updated customer:', customers[index].name);
    }
  }

  public async deleteCustomer(id: number): Promise<void> {
    const index = customers.findIndex(c => c.id === id);
    if (index !== -1) {
      customers[index].is_active = 0;
      saveToLocalStorage();
    }
  }

  // ============ TRANSACTIONS ============
  public async getTransactions(): Promise<any[]> {
    return [...transactions];
  }

  public async getTodayTransactions(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    return transactions.filter(t => t.created_at.startsWith(today));
  }

  // Alias for getTodaysTransactions (used by DashboardScreen)
  public async getTodaysTransactions(): Promise<any[]> {
    return this.getTodayTransactions();
  }

  // Get transactions by cashier (used by DashboardScreen for CASHIER role)
  public async getTransactionsByCashier(cashierId: number): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    return transactions.filter(t =>
      t.cashier_id === cashierId &&
      t.created_at.startsWith(today)
    );
  }

  public async createTransaction(transaction: any): Promise<number> {
    const transactionId = transactionIdCounter++;
    const newTransaction = {
      ...transaction,
      id: transactionId,
      created_at: new Date().toISOString(),
    };
    transactions.push(newTransaction);

    // CRITICAL: Reduce stock for each item in the transaction
    if (transaction.items && Array.isArray(transaction.items)) {
      for (const item of transaction.items) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          // Reduce stock
          product.stock_quantity = Math.max(0, product.stock_quantity - item.quantity);
          console.log(`[WebMock] Stock reduced: ${product.name} -${item.quantity} = ${product.stock_quantity}`);

          // Create inventory movement for the sale
          inventoryMovements.push({
            id: ++inventoryMovementIdCounter,
            product_id: item.product_id,
            movement_type: 'OUT',
            quantity: item.quantity,
            reference_type: 'SALE',
            reference_id: transaction.transaction_number || `TXN-${transactionId}`,
            notes: `Sale transaction`,
            created_by: transaction.cashier_id || 1,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // Handle credit sales (CHARGE_INVOICE) - create AR record
    if (transaction.payment_method === 'CHARGE_INVOICE' && transaction.customer_id) {
      const arRecord = {
        id: ++arIdCounter,
        customer_id: transaction.customer_id,
        customer_name: transaction.customer_name || 'Walk-in',
        transaction_id: transactionId,
        transaction_number: transaction.transaction_number,
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        original_amount: transaction.total_amount,
        balance: transaction.total_amount,
        status: 'UNPAID',
        created_at: new Date().toISOString(),
      };
      accountsReceivable.push(arRecord);
      console.log(`[WebMock] AR created for customer ${transaction.customer_name}: ₱${transaction.total_amount}`);

      // Update customer balance
      const customer = customers.find(c => c.id === transaction.customer_id);
      if (customer) {
        customer.balance = (customer.balance || 0) + transaction.total_amount;
      }
    }

    // Create eJournal entry
    eJournalEntries.push({
      id: ++eJournalIdCounter,
      entry_type: 'SALE',
      reference_number: transaction.transaction_number || `TXN-${transactionId}`,
      description: `Sale - ${transaction.payment_method} - ${transaction.items?.length || 0} items`,
      amount: transaction.total_amount,
      cashier_id: transaction.cashier_id,
      created_at: new Date().toISOString(),
    });

    saveToLocalStorage();
    console.log(`[WebMock] Transaction created: ${transactionId}, items: ${transaction.items?.length || 0}`);
    return transactionId;
  }

  // ============ SETTINGS ============
  public async getSetting(key: string): Promise<string | null> {
    return settings[key] || null;
  }

  public async setSetting(key: string, value: string): Promise<void> {
    settings[key] = value;
    saveToLocalStorage();
  }

  // Alias for setSetting (used by SettingsScreen)
  public async updateSetting(key: string, value: string): Promise<void> {
    return this.setSetting(key, value);
  }

  public async getSettings(): Promise<Record<string, string>> {
    return { ...settings };
  }

  // ============ REPORTS (Real Data) ============
  public async getDailySales(date: string): Promise<any> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dayTransactions = transactions.filter(t =>
      t.created_at?.startsWith(targetDate) && t.status === 'COMPLETED'
    );

    const totalSales = dayTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const totalItems = dayTransactions.reduce((sum, t) => sum + (t.items?.length || 0), 0);
    const vatAmount = totalSales * 0.12 / 1.12; // Extract VAT from VAT-inclusive amount

    return {
      date: targetDate,
      total_sales: totalSales,
      total_transactions: dayTransactions.length,
      total_items: totalItems,
      vat_amount: vatAmount,
    };
  }

  public async getXReading(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t =>
      t.created_at?.startsWith(today) && t.status === 'COMPLETED'
    );

    const totalSales = todayTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const cashSales = todayTransactions
      .filter(t => t.payment_method === 'CASH')
      .reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const creditSales = todayTransactions
      .filter(t => t.payment_method === 'CHARGE_INVOICE')
      .reduce((sum, t) => sum + (t.total_amount || 0), 0);

    const vatAmount = totalSales * 0.12 / 1.12;
    const vatSales = totalSales - vatAmount;

    return {
      date: new Date().toISOString(),
      reading_number: `X-${Date.now()}`,
      total_sales: totalSales,
      total_transactions: todayTransactions.length,
      cash_sales: cashSales,
      credit_sales: creditSales,
      card_sales: todayTransactions
        .filter(t => t.payment_method === 'CARD')
        .reduce((sum, t) => sum + (t.total_amount || 0), 0),
      gcash_sales: todayTransactions
        .filter(t => t.payment_method === 'ONLINE')
        .reduce((sum, t) => sum + (t.total_amount || 0), 0),
      vat_sales: vatSales,
      vat_exempt: 0,
      vat_amount: vatAmount,
      void_count: todayTransactions.filter(t => t.status === 'VOID').length,
      void_amount: todayTransactions
        .filter(t => t.status === 'VOID')
        .reduce((sum, t) => sum + (t.total_amount || 0), 0),
    };
  }

  public async getZReading(): Promise<any> {
    const xReading = await this.getXReading();
    return {
      ...xReading,
      reading_number: `Z-${Date.now()}`,
      is_final: true,
    };
  }

  // ============ INVENTORY ============
  public async getLowStockProducts(threshold?: number): Promise<any[]> {
    return products.filter(p => p.stock_quantity <= (threshold || p.reorder_level || 10));
  }

  // ============ PURCHASES ============
  public async getPurchases(limit?: number): Promise<any[]> {
    const result = [...purchases].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return limit ? result.slice(0, limit) : result;
  }

  public async createPurchase(purchaseData: any): Promise<{ purchaseId: string; id: number }> {
    const purchaseId = `PO-${String(++purchaseIdCounter).padStart(6, '0')}`;
    const newPurchase = {
      id: purchaseIdCounter,
      purchase_id: purchaseId,
      supplier_id: purchaseData.supplier_id,
      supplier_name: purchaseData.supplier_name,
      total_amount: purchaseData.total_amount || 0,
      paid_amount: purchaseData.paid_amount || 0,
      balance: (purchaseData.total_amount || 0) - (purchaseData.paid_amount || 0),
      payment_method: purchaseData.payment_method || 'CASH',
      status: purchaseData.status || 'COMPLETED',
      notes: purchaseData.notes,
      created_by: purchaseData.created_by || 1,
      created_at: new Date().toISOString(),
    };
    purchases.push(newPurchase);

    // Process items - add to inventory
    if (purchaseData.items && Array.isArray(purchaseData.items)) {
      for (const item of purchaseData.items) {
        // Add purchase item record
        purchaseItems.push({
          id: ++purchaseItemIdCounter,
          purchase_id: purchaseId,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.quantity * item.unit_cost,
          created_at: new Date().toISOString(),
        });

        // INCREASE stock
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          product.stock_quantity = (product.stock_quantity || 0) + item.quantity;
          // Update cost if provided
          if (item.unit_cost) {
            product.cost = item.unit_cost;
          }
          console.log(`[WebMock] Stock increased: ${product.name} +${item.quantity} = ${product.stock_quantity}`);

          // Create inventory movement
          inventoryMovements.push({
            id: ++inventoryMovementIdCounter,
            product_id: item.product_id,
            movement_type: 'IN',
            quantity: item.quantity,
            reference_type: 'PURCHASE',
            reference_id: purchaseId,
            notes: `Purchase from ${purchaseData.supplier_name}`,
            created_by: purchaseData.created_by || 1,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // Handle credit purchases - create AP record
    if (newPurchase.balance > 0) {
      accountsPayable.push({
        id: ++apIdCounter,
        supplier_id: purchaseData.supplier_id,
        supplier_name: purchaseData.supplier_name,
        purchase_id: purchaseId,
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        original_amount: newPurchase.total_amount,
        paid_amount: newPurchase.paid_amount,
        balance: newPurchase.balance,
        status: 'UNPAID',
        created_at: new Date().toISOString(),
      });
      console.log(`[WebMock] AP created for supplier ${purchaseData.supplier_name}: ₱${newPurchase.balance}`);
    }

    // Create eJournal entry
    eJournalEntries.push({
      id: ++eJournalIdCounter,
      entry_type: 'PURCHASE',
      reference_number: purchaseId,
      description: `Purchase from ${purchaseData.supplier_name}`,
      amount: newPurchase.total_amount,
      cashier_id: purchaseData.created_by,
      created_at: new Date().toISOString(),
    });

    saveToLocalStorage();
    return { purchaseId, id: purchaseIdCounter };
  }

  public async getDamagedItemsSessions(): Promise<any[]> {
    return damageSessions;
  }
  public async getInventoryMovements(options?: any): Promise<any[]> {
    let result = [...inventoryMovements];

    // Handle different call signatures
    let productId: number | undefined;
    let limit: number | undefined;
    let movementType: string | undefined;
    let referenceType: string | undefined;
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    if (typeof options === 'number') {
      // Old signature: getInventoryMovements(productId, limit)
      productId = options;
    } else if (typeof options === 'object' && options !== null) {
      // New signature: getInventoryMovements({ limit, movement_type, ... })
      productId = options.product_id;
      limit = options.limit;
      movementType = options.movement_type;
      referenceType = options.reference_type;
      dateFrom = options.date_from;
      dateTo = options.date_to;
    }

    // Filter by product if specified
    if (productId) {
      result = result.filter(m => m.product_id === productId);
    }

    // Filter by movement type
    if (movementType) {
      result = result.filter(m => m.movement_type === movementType);
    }

    // Filter by reference type
    if (referenceType) {
      result = result.filter(m => m.reference_type === referenceType);
    }

    // Filter by date range
    if (dateFrom) {
      result = result.filter(m => m.created_at >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(m => m.created_at <= dateTo + 'T23:59:59');
    }

    // Sort by created_at descending (most recent first)
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply limit
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }

    // Add product names and user info
    return result.map(m => {
      const product = products.find(p => p.id === m.product_id);
      const user = users.find(u => u.id === m.created_by);
      return {
        ...m,
        product_name: product?.name || 'Unknown Product',
        product_code: product?.code || '',
        created_by_name: user?.full_name || 'Unknown User',
        quantity_before: m.quantity_before || 0,
        quantity_after: m.quantity_after || 0,
        total_value: (m.quantity || 0) * (product?.cost || 0)
      };
    });
  }

  public async createInventoryMovement(movement: any): Promise<number> {
    const newMovement = {
      id: inventoryMovementIdCounter++,
      product_id: movement.product_id,
      movement_type: movement.movement_type, // 'IN' or 'OUT'
      quantity: movement.quantity,
      reference_type: movement.reference_type, // 'SALE', 'PURCHASE', 'MANUAL_ADJUSTMENT', 'DAMAGE', 'PHYSICAL_COUNT'
      reference_id: movement.reference_id || null,
      notes: movement.notes || null,
      created_by: movement.created_by,
      created_at: new Date().toISOString(),
    };
    inventoryMovements.push(newMovement);
    saveToLocalStorage();
    console.log('[WebMock] Inventory movement created:', newMovement);
    return newMovement.id;
  }
  // ============ ACCOUNTS RECEIVABLE (Customer Credit) ============
  public async getAccountsReceivable(customerId?: number): Promise<any[]> {
    let result = [...accountsReceivable];
    if (customerId) {
      result = result.filter(ar => ar.customer_id === customerId);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getCustomerPayments(customerId?: number): Promise<any[]> {
    let result = [...customerPayments];
    if (customerId) {
      result = result.filter(p => p.customer_id === customerId);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async processCustomerPayment(paymentData: {
    customer_id: number;
    amount: number;
    payment_method: string;
    reference_number?: string;
    notes?: string;
    received_by: number;
  }): Promise<number> {
    const customer = customers.find(c => c.id === paymentData.customer_id);
    if (!customer) throw new Error('Customer not found');

    const paymentId = ++customerPaymentIdCounter;
    const payment = {
      id: paymentId,
      payment_number: `CP-${String(paymentId).padStart(6, '0')}`,
      customer_id: paymentData.customer_id,
      customer_name: customer.name,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      reference_number: paymentData.reference_number,
      notes: paymentData.notes,
      received_by: paymentData.received_by,
      created_at: new Date().toISOString(),
    };
    customerPayments.push(payment);

    // Apply payment to outstanding AR records (FIFO)
    let remainingAmount = paymentData.amount;
    const unpaidAR = accountsReceivable
      .filter(ar => ar.customer_id === paymentData.customer_id && ar.balance > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const ar of unpaidAR) {
      if (remainingAmount <= 0) break;
      const applyAmount = Math.min(remainingAmount, ar.balance);
      ar.paid_amount = (ar.paid_amount || 0) + applyAmount;
      ar.balance -= applyAmount;
      ar.status = ar.balance <= 0 ? 'PAID' : 'PARTIAL';
      remainingAmount -= applyAmount;
      console.log(`[WebMock] Applied ₱${applyAmount} to AR ${ar.transaction_number}, balance: ₱${ar.balance}`);
    }

    // Update customer balance
    customer.balance = Math.max(0, (customer.balance || 0) - paymentData.amount);

    // Create eJournal entry
    eJournalEntries.push({
      id: ++eJournalIdCounter,
      entry_type: 'CUSTOMER_PAYMENT',
      reference_number: payment.payment_number,
      description: `Payment from ${customer.name}`,
      amount: paymentData.amount,
      cashier_id: paymentData.received_by,
      created_at: new Date().toISOString(),
    });

    saveToLocalStorage();
    console.log(`[WebMock] Customer payment processed: ₱${paymentData.amount} from ${customer.name}`);
    return paymentId;
  }

  public async getCustomerBalance(customerId: number): Promise<number> {
    const customer = customers.find(c => c.id === customerId);
    return customer?.balance || 0;
  }

  public async getCustomerLedger(customerId: number): Promise<any[]> {
    const arRecords = accountsReceivable.filter(ar => ar.customer_id === customerId);
    const payments = customerPayments.filter(p => p.customer_id === customerId);

    const ledger = [
      ...arRecords.map(ar => ({
        date: ar.created_at,
        type: 'CHARGE',
        reference: ar.transaction_number,
        description: 'Credit Sale',
        debit: ar.original_amount,
        credit: 0,
      })),
      ...payments.map(p => ({
        date: p.created_at,
        type: 'PAYMENT',
        reference: p.payment_number,
        description: `Payment - ${p.payment_method}`,
        debit: 0,
        credit: p.amount,
      })),
    ];

    return ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // ============ ACCOUNTS PAYABLE (Supplier Credit) ============
  public async getAccountsPayable(supplierId?: number): Promise<any[]> {
    let result = [...accountsPayable];
    if (supplierId) {
      result = result.filter(ap => ap.supplier_id === supplierId);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getSupplierPayments(supplierId?: number): Promise<any[]> {
    let result = [...supplierPayments];
    if (supplierId) {
      result = result.filter(p => p.supplier_id === supplierId);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async createSupplierPayment(paymentData: {
    supplier_id: number;
    amount: number;
    payment_method: string;
    reference_number?: string;
    notes?: string;
    paid_by: number;
  }): Promise<number> {
    const supplier = suppliers.find(s => s.id === paymentData.supplier_id);
    if (!supplier) throw new Error('Supplier not found');

    const paymentId = ++supplierPaymentIdCounter;
    const payment = {
      id: paymentId,
      payment_number: `SP-${String(paymentId).padStart(6, '0')}`,
      supplier_id: paymentData.supplier_id,
      supplier_name: supplier.name,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      reference_number: paymentData.reference_number,
      notes: paymentData.notes,
      paid_by: paymentData.paid_by,
      created_at: new Date().toISOString(),
    };
    supplierPayments.push(payment);

    // Apply payment to outstanding AP records (FIFO)
    let remainingAmount = paymentData.amount;
    const unpaidAP = accountsPayable
      .filter(ap => ap.supplier_id === paymentData.supplier_id && ap.balance > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const ap of unpaidAP) {
      if (remainingAmount <= 0) break;
      const applyAmount = Math.min(remainingAmount, ap.balance);
      ap.paid_amount = (ap.paid_amount || 0) + applyAmount;
      ap.balance -= applyAmount;
      ap.status = ap.balance <= 0 ? 'PAID' : 'PARTIAL';
      remainingAmount -= applyAmount;
      console.log(`[WebMock] Applied ₱${applyAmount} to AP ${ap.purchase_id}, balance: ₱${ap.balance}`);
    }

    // Update supplier balance
    if (supplier.balance !== undefined) {
      supplier.balance = Math.max(0, supplier.balance - paymentData.amount);
    }

    // Create eJournal entry
    eJournalEntries.push({
      id: ++eJournalIdCounter,
      entry_type: 'SUPPLIER_PAYMENT',
      reference_number: payment.payment_number,
      description: `Payment to ${supplier.name}`,
      amount: paymentData.amount,
      cashier_id: paymentData.paid_by,
      created_at: new Date().toISOString(),
    });

    saveToLocalStorage();
    console.log(`[WebMock] Supplier payment processed: ₱${paymentData.amount} to ${supplier.name}`);
    return paymentId;
  }

  public async getAccountsPayableAging(): Promise<any> {
    const now = new Date();
    const aging = {
      current: 0,      // 0-30 days
      days_31_60: 0,   // 31-60 days
      days_61_90: 0,   // 61-90 days
      over_90: 0,      // >90 days
      total: 0,
      details: [] as any[],
    };

    for (const ap of accountsPayable.filter(a => a.balance > 0)) {
      const invoiceDate = new Date(ap.invoice_date);
      const daysDiff = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 30) {
        aging.current += ap.balance;
      } else if (daysDiff <= 60) {
        aging.days_31_60 += ap.balance;
      } else if (daysDiff <= 90) {
        aging.days_61_90 += ap.balance;
      } else {
        aging.over_90 += ap.balance;
      }
      aging.total += ap.balance;

      aging.details.push({
        ...ap,
        days_outstanding: daysDiff,
        aging_bucket: daysDiff <= 30 ? 'Current' : daysDiff <= 60 ? '31-60' : daysDiff <= 90 ? '61-90' : 'Over 90',
      });
    }

    return aging;
  }

  public async getAccountsReceivableAging(): Promise<any> {
    const now = new Date();
    const aging = {
      current: 0,
      days_31_60: 0,
      days_61_90: 0,
      over_90: 0,
      total: 0,
      details: [] as any[],
    };

    for (const ar of accountsReceivable.filter(a => a.balance > 0)) {
      const invoiceDate = new Date(ar.invoice_date);
      const daysDiff = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 30) {
        aging.current += ar.balance;
      } else if (daysDiff <= 60) {
        aging.days_31_60 += ar.balance;
      } else if (daysDiff <= 90) {
        aging.days_61_90 += ar.balance;
      } else {
        aging.over_90 += ar.balance;
      }
      aging.total += ar.balance;

      aging.details.push({
        ...ar,
        days_outstanding: daysDiff,
        aging_bucket: daysDiff <= 30 ? 'Current' : daysDiff <= 60 ? '31-60' : daysDiff <= 90 ? '61-90' : 'Over 90',
      });
    }

    return aging;
  }

  public async getSupplierBalance(supplierId: number): Promise<number> {
    const unpaidAP = accountsPayable.filter(ap => ap.supplier_id === supplierId && ap.balance > 0);
    return unpaidAP.reduce((sum, ap) => sum + ap.balance, 0);
  }

  public async getSupplierLedger(supplierId: number): Promise<any[]> {
    const apRecords = accountsPayable.filter(ap => ap.supplier_id === supplierId);
    const payments = supplierPayments.filter(p => p.supplier_id === supplierId);

    const ledger = [
      ...apRecords.map(ap => ({
        date: ap.created_at,
        type: 'PURCHASE',
        reference: ap.purchase_id,
        description: 'Credit Purchase',
        debit: 0,
        credit: ap.original_amount,
      })),
      ...payments.map(p => ({
        date: p.created_at,
        type: 'PAYMENT',
        reference: p.payment_number,
        description: `Payment - ${p.payment_method}`,
        debit: p.amount,
        credit: 0,
      })),
    ];

    return ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // ============ PHYSICAL COUNT SESSIONS ============
  // Note: physicalCountSessions and physicalCountDetails are now module-level variables

  public async createPhysicalCountSession(sessionData: any): Promise<string> {
    // Use the session_id provided if available, otherwise generate one
    const sessionId = sessionData.session_id || `PC${Date.now()}`;
    const newSession = {
      id: sessionId,
      session_id: sessionId,
      date: sessionData.date || new Date().toISOString().split('T')[0],
      started_by: sessionData.started_by,
      total_items: sessionData.total_items || 0,
      counted_items: sessionData.counted_items || 0,
      discrepancy_count: sessionData.discrepancy_count || 0,
      total_discrepancy_value: sessionData.total_discrepancy_value || 0,
      notes: sessionData.notes || '',
      status: sessionData.status || 'IN_PROGRESS',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    physicalCountSessions.push(newSession);
    saveToLocalStorage();
    console.log('[WebMock] Created physical count session:', sessionId);
    return sessionId;
  }

  public async updatePhysicalCountSession(sessionId: string, updates: any): Promise<void> {
    const index = physicalCountSessions.findIndex(s => s.session_id === sessionId || s.id === sessionId);
    if (index !== -1) {
      physicalCountSessions[index] = {
        ...physicalCountSessions[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
      console.log('[WebMock] Updated physical count session:', sessionId, updates);
    } else {
      console.log('[WebMock] Physical count session not found:', sessionId);
    }
  }

  public async createPhysicalCountDetail(detailData: any): Promise<number> {
    const newId = ++physicalCountDetailIdCounter;
    const newDetail = {
      id: newId,
      session_id: detailData.session_id,
      product_id: detailData.product_id,
      product_code: detailData.product_code,
      product_name: detailData.product_name,
      system_quantity: detailData.system_quantity,
      physical_quantity: detailData.physical_quantity || 0,
      discrepancy: detailData.discrepancy || 0,
      unit_cost: detailData.unit_cost || 0,
      value_discrepancy: detailData.value_discrepancy || 0,
      status: detailData.status || 'pending',
      counted_by: detailData.counted_by || null,
      notes: detailData.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    physicalCountDetails.push(newDetail);
    saveToLocalStorage();
    console.log('[WebMock] Created physical count detail:', newDetail.product_name);
    return newId;
  }

  public async updatePhysicalCountDetail(sessionId: string, productId: number, updates: any): Promise<void> {
    const index = physicalCountDetails.findIndex(
      d => d.session_id === sessionId && d.product_id === productId
    );
    if (index !== -1) {
      physicalCountDetails[index] = {
        ...physicalCountDetails[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      saveToLocalStorage();
      console.log('[WebMock] Updated physical count detail for product:', productId, updates);
    } else {
      console.log('[WebMock] Physical count detail not found:', sessionId, productId);
    }
  }

  public async getPhysicalCountSessions(limit?: number): Promise<any[]> {
    console.log('[WebMock] Getting physical count sessions, total:', physicalCountSessions.length);
    const result = [...physicalCountSessions].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return limit ? result.slice(0, limit) : result;
  }

  public async getPhysicalCountDetails(sessionId: string): Promise<any[]> {
    console.log('[WebMock] Getting physical count details for session:', sessionId);
    return physicalCountDetails.filter(d => d.session_id === sessionId);
  }

  public async getPhysicalCountReport(sessionId?: string, startDate?: string, endDate?: string): Promise<any[]> {
    console.log('[WebMock] Getting physical count report, sessions:', physicalCountSessions.length);
    let result = [...physicalCountSessions];

    if (sessionId) {
      result = result.filter(s => s.session_id === sessionId);
    }

    if (startDate) {
      result = result.filter(s => s.date >= startDate);
    }

    if (endDate) {
      result = result.filter(s => s.date <= endDate);
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async clearPhysicalInventoryData(): Promise<void> {
    physicalCountSessions.length = 0;
    physicalCountDetails.length = 0;
    // Reset all product stock to 0
    products.forEach(p => { p.stock_quantity = 0; });
    saveToLocalStorage();
    console.log('[WebMock] Physical inventory data cleared');
  }

  // ============ DAMAGED ITEMS MANAGEMENT ============

  public async getDamageSessions(limit?: number): Promise<any[]> {
    console.log('[WebMock] Getting damage sessions, total:', damageSessions.length);
    const result = [...damageSessions].sort((a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );

    // Add user names for display
    const enriched = result.map(session => {
      const startedByUser = users.find(u => u.id === session.started_by);
      return {
        ...session,
        started_by_name: startedByUser?.full_name || 'Unknown',
      };
    });

    return limit ? enriched.slice(0, limit) : enriched;
  }

  public async createDamageSession(sessionData: {
    session_name: string;
    notes?: string;
    started_by: number;
  }): Promise<{ sessionId: string; sessionDbId: number }> {
    const sessionId = `DMG-${String(++damageSessionIdCounter).padStart(6, '0')}`;
    const newSession = {
      id: damageSessionIdCounter,
      session_id: sessionId,
      session_name: sessionData.session_name,
      notes: sessionData.notes || null,
      started_by: sessionData.started_by,
      status: 'ACTIVE',
      total_items: 0,
      total_quantity: 0,
      total_value: 0,
      started_at: new Date().toISOString(),
      completed_at: null,
      completed_by: null,
      cancelled_at: null,
      cancelled_by: null,
    };
    damageSessions.push(newSession);
    saveToLocalStorage();
    console.log('[WebMock] Created damage session:', sessionId);
    return { sessionId, sessionDbId: damageSessionIdCounter };
  }

  public async getDamageSessionById(sessionId: string): Promise<any> {
    const session = damageSessions.find(s => s.session_id === sessionId);
    if (session) {
      const startedByUser = users.find(u => u.id === session.started_by);
      const items = damageDetails.filter(d => d.session_id === sessionId);
      return {
        ...session,
        started_by_name: startedByUser?.full_name || 'Unknown',
        items,
      };
    }
    return null;
  }

  public async addDamagedItem(damageData: {
    session_id: string;
    product_id: number;
    damaged_quantity: number;
    damage_reason: 'EXPIRED' | 'BROKEN' | 'DEFECTIVE' | 'SPOILED' | 'LOST' | 'THEFT' | 'OTHER';
    damage_description?: string;
    recorded_by: number;
  }): Promise<number> {
    // Find product
    const product = products.find(p => p.id === damageData.product_id);
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.stock_quantity < damageData.damaged_quantity) {
      throw new Error('Insufficient stock quantity');
    }

    const totalValue = damageData.damaged_quantity * (product.cost || 0);
    const newId = ++damageDetailIdCounter;

    // Create damage detail
    const newDetail = {
      id: newId,
      session_id: damageData.session_id,
      product_id: damageData.product_id,
      product_code: product.code,
      product_name: product.name,
      current_stock: product.stock_quantity,
      damaged_quantity: damageData.damaged_quantity,
      unit_cost: product.cost || 0,
      total_value: totalValue,
      damage_reason: damageData.damage_reason,
      damage_description: damageData.damage_description || null,
      recorded_by: damageData.recorded_by,
      recorded_at: new Date().toISOString(),
    };
    damageDetails.push(newDetail);

    // Reduce product stock
    product.stock_quantity -= damageData.damaged_quantity;

    // Update session totals
    const sessionIndex = damageSessions.findIndex(s => s.session_id === damageData.session_id);
    if (sessionIndex !== -1) {
      damageSessions[sessionIndex].total_items += 1;
      damageSessions[sessionIndex].total_quantity += damageData.damaged_quantity;
      damageSessions[sessionIndex].total_value += totalValue;
    }

    // Create inventory movement for the damage
    await this.createInventoryMovement({
      product_id: damageData.product_id,
      movement_type: 'OUT',
      quantity: damageData.damaged_quantity,
      reference_type: 'DAMAGE',
      reference_id: damageData.session_id,
      notes: `Damaged: ${damageData.damage_reason} - ${damageData.damage_description || 'No description'}`,
      created_by: damageData.recorded_by,
    });

    saveToLocalStorage();
    console.log('[WebMock] Added damaged item:', product.name, 'qty:', damageData.damaged_quantity);
    return newId;
  }

  public async completeDamageSession(sessionId: string, userId: number): Promise<void> {
    const sessionIndex = damageSessions.findIndex(s => s.session_id === sessionId);
    if (sessionIndex !== -1) {
      damageSessions[sessionIndex].status = 'COMPLETED';
      damageSessions[sessionIndex].completed_at = new Date().toISOString();
      damageSessions[sessionIndex].completed_by = userId;
      saveToLocalStorage();
      console.log('[WebMock] Completed damage session:', sessionId);
    }
  }

  public async cancelDamageSession(sessionId: string, userId: number): Promise<void> {
    const sessionIndex = damageSessions.findIndex(s => s.session_id === sessionId);
    if (sessionIndex !== -1) {
      damageSessions[sessionIndex].status = 'CANCELLED';
      damageSessions[sessionIndex].cancelled_at = new Date().toISOString();
      damageSessions[sessionIndex].cancelled_by = userId;
      saveToLocalStorage();
      console.log('[WebMock] Cancelled damage session:', sessionId);
    }
  }

  public async getDamageSessionDetails(sessionId: string): Promise<any[]> {
    return damageDetails.filter(d => d.session_id === sessionId);
  }

  // ============ USER MANAGEMENT ============
  public async updateUserLastLogin(userId: number): Promise<void> {
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index].last_login = new Date().toISOString();
    }
  }

  public async createUser(user: any): Promise<number> {
    const newUser = {
      ...user,
      id: users.length + 1,
      is_active: 1,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    return newUser.id;
  }

  public async updateUser(id: number, user: any): Promise<void> {
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...user };
    }
  }

  // ============ EJOURNAL ============
  public async createEJournalEntry(entry: any): Promise<number> {
    console.log('[WebMock] eJournal entry:', entry.description);
    return Date.now(); // Return a mock ID
  }

  public async getEJournalEntries(): Promise<any[]> {
    return [];
  }

  // ============ PERMISSIONS ============
  public async getRolePermissions(role: string): Promise<any[]> {
    // Return all permissions for admin, limited for others
    if (role === 'ADMIN') {
      return [
        { permission: 'SALES_CREATE', granted: true },
        { permission: 'SALES_VIEW', granted: true },
        { permission: 'PRODUCTS_CREATE', granted: true },
        { permission: 'PRODUCTS_VIEW', granted: true },
        { permission: 'PRODUCTS_EDIT', granted: true },
        { permission: 'PRODUCTS_DELETE', granted: true },
        { permission: 'REPORTS_VIEW', granted: true },
        { permission: 'SETTINGS_VIEW', granted: true },
        { permission: 'SETTINGS_EDIT', granted: true },
        { permission: 'USERS_VIEW', granted: true },
        { permission: 'USERS_EDIT', granted: true },
      ];
    }
    return [
      { permission: 'SALES_CREATE', granted: true },
      { permission: 'SALES_VIEW', granted: true },
      { permission: 'PRODUCTS_VIEW', granted: true },
    ];
  }

  public async getUserPermissions(userId: number): Promise<any[]> {
    return [];
  }

  public async getEnabledPermissionsForRole(role: string): Promise<string[]> {
    // Return all permissions for testing
    if (role === 'ADMIN') {
      return [
        'VIEW_DASHBOARD', 'CREATE_SALE', 'VIEW_ALL_SALES', 'VIEW_OWN_SALES',
        'VOID_SALE', 'REFUND_SALE', 'MANAGE_PRODUCTS', 'VIEW_PRODUCTS',
        'MANAGE_INVENTORY', 'VIEW_REPORTS', 'MANAGE_USERS', 'VIEW_SETTINGS',
        'MANAGE_SETTINGS', 'PERFORM_Z_READING', 'PERFORM_X_READING', 'VIEW_EJOURNAL',
        'MANAGE_PURCHASES', 'MANAGE_SUPPLIERS', 'CREATE_PURCHASE_ORDER',
        'MANAGE_SUPPLIER_PAYMENTS', 'MANAGE_DAMAGED_ITEMS', 'MANAGE_CUSTOMERS',
        'COLLECT_CUSTOMER_PAYMENTS'
      ];
    }
    if (role === 'MANAGER') {
      return [
        'VIEW_DASHBOARD', 'CREATE_SALE', 'VIEW_ALL_SALES', 'VIEW_OWN_SALES',
        'VOID_SALE', 'REFUND_SALE', 'MANAGE_PRODUCTS', 'VIEW_PRODUCTS',
        'MANAGE_INVENTORY', 'VIEW_REPORTS', 'VIEW_SETTINGS',
        'PERFORM_Z_READING', 'PERFORM_X_READING', 'VIEW_EJOURNAL',
        'MANAGE_PURCHASES', 'MANAGE_SUPPLIERS', 'CREATE_PURCHASE_ORDER',
        'MANAGE_SUPPLIER_PAYMENTS', 'MANAGE_DAMAGED_ITEMS', 'MANAGE_CUSTOMERS',
        'COLLECT_CUSTOMER_PAYMENTS'
      ];
    }
    // CASHIER
    return [
      'VIEW_DASHBOARD', 'CREATE_SALE', 'VIEW_OWN_SALES', 'VIEW_PRODUCTS'
    ];
  }

  // ============ ADDITIONAL STUB METHODS ============
  public async getInventoryMovementsSummary(dateFrom?: string, dateTo?: string): Promise<any> {
    let filtered = [...inventoryMovements];

    // Apply date filters
    if (dateFrom) {
      filtered = filtered.filter(m => m.created_at >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(m => m.created_at <= dateTo + 'T23:59:59');
    }

    const totalIn = filtered
      .filter(m => m.movement_type === 'IN')
      .reduce((sum, m) => sum + (m.quantity || 0), 0);
    const totalOut = filtered
      .filter(m => m.movement_type === 'OUT')
      .reduce((sum, m) => sum + (m.quantity || 0), 0);

    // Calculate total value
    const totalValue = filtered.reduce((sum, m) => {
      const product = products.find(p => p.id === m.product_id);
      return sum + ((m.quantity || 0) * (product?.cost || 0));
    }, 0);

    // Group by movement type and reference type
    const movementTypeSummary: any[] = [];
    const grouped: Record<string, any> = {};

    filtered.forEach(m => {
      const key = `${m.movement_type}_${m.reference_type}`;
      if (!grouped[key]) {
        grouped[key] = {
          movement_type: m.movement_type,
          reference_type: m.reference_type,
          transaction_count: 0,
          total_quantity: 0,
          total_value: 0
        };
      }
      grouped[key].transaction_count++;
      grouped[key].total_quantity += m.quantity || 0;
      const product = products.find(p => p.id === m.product_id);
      grouped[key].total_value += (m.quantity || 0) * (product?.cost || 0);
    });

    Object.values(grouped).forEach(g => movementTypeSummary.push(g));

    // Group by product
    const productGrouped: Record<number, any> = {};
    filtered.forEach(m => {
      if (!productGrouped[m.product_id]) {
        const product = products.find(p => p.id === m.product_id);
        productGrouped[m.product_id] = {
          product_id: m.product_id,
          product_name: product?.name || 'Unknown',
          product_code: product?.code || '',
          transaction_count: 0,
          total_in: 0,
          total_out: 0,
          total_value: 0
        };
      }
      productGrouped[m.product_id].transaction_count++;
      if (m.movement_type === 'IN') {
        productGrouped[m.product_id].total_in += m.quantity || 0;
      } else {
        productGrouped[m.product_id].total_out += m.quantity || 0;
      }
      const product = products.find(p => p.id === m.product_id);
      productGrouped[m.product_id].total_value += (m.quantity || 0) * (product?.cost || 0);
    });

    const productSummary = Object.values(productGrouped)
      .sort((a, b) => b.transaction_count - a.transaction_count)
      .slice(0, 10);

    return {
      overallTotals: {
        total_transactions: filtered.length,
        total_in_quantity: totalIn,
        total_out_quantity: totalOut,
        total_value: totalValue,
        net_movement: totalIn - totalOut
      },
      movementTypeSummary,
      productSummary
    };
  }

  public async getDamagedItemsHistory(): Promise<any[]> {
    return [];
  }

  public async getAllUsers(): Promise<any[]> {
    return [...users];
  }

  // ============ SALES RETURNS ============
  public async getSalesReturns(customerId?: number): Promise<any[]> {
    let result = [...salesReturns];
    if (customerId) {
      result = result.filter(r => r.customer_id === customerId);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getSalesReturnItems(returnId: number): Promise<any[]> {
    return salesReturnItems.filter(item => item.return_id === returnId);
  }

  public async getTransactionForReturn(transactionNumber: string): Promise<any | null> {
    const transaction = transactions.find(t =>
      t.transaction_number === transactionNumber && t.status === 'COMPLETED'
    );
    return transaction || null;
  }

  public async processSalesReturn(returnData: {
    original_transaction_id?: number;
    original_transaction_number?: string;
    customer_id?: number;
    customer_name?: string;
    items: Array<{
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      reason: string;
    }>;
    refund_method: 'CASH' | 'CREDIT' | 'STORE_CREDIT';
    notes?: string;
    created_by: number;
  }): Promise<{ returnId: number; returnNumber: string }> {
    const returnId = ++salesReturnIdCounter;
    const returnNumber = `RTN-${String(returnId).padStart(6, '0')}`;

    // Calculate total return amount
    const totalAmount = returnData.items.reduce(
      (sum, item) => sum + (item.quantity * item.unit_price), 0
    );

    // Create return record
    const newReturn = {
      id: returnId,
      return_number: returnNumber,
      original_transaction_id: returnData.original_transaction_id,
      original_transaction_number: returnData.original_transaction_number,
      customer_id: returnData.customer_id,
      customer_name: returnData.customer_name || 'Walk-in',
      total_amount: totalAmount,
      refund_method: returnData.refund_method,
      notes: returnData.notes,
      status: 'COMPLETED',
      created_by: returnData.created_by,
      created_at: new Date().toISOString(),
    };
    salesReturns.push(newReturn);

    // Process each return item
    for (const item of returnData.items) {
      // Add return item record
      salesReturnItems.push({
        id: ++salesReturnItemIdCounter,
        return_id: returnId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        reason: item.reason,
        created_at: new Date().toISOString(),
      });

      // INCREASE stock (return item back to inventory)
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        product.stock_quantity = (product.stock_quantity || 0) + item.quantity;
        console.log(`[WebMock] Return: Stock increased for ${product.name} +${item.quantity} = ${product.stock_quantity}`);

        // Create inventory movement for return
        inventoryMovements.push({
          id: ++inventoryMovementIdCounter,
          product_id: item.product_id,
          movement_type: 'IN',
          quantity: item.quantity,
          reference_type: 'RETURN',
          reference_id: returnNumber,
          notes: `Sales return: ${item.reason}`,
          created_by: returnData.created_by,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Handle refund based on method
    if (returnData.refund_method === 'CREDIT' && returnData.customer_id) {
      // Reduce customer's outstanding balance (AR)
      const unpaidAR = accountsReceivable.filter(
        ar => ar.customer_id === returnData.customer_id && ar.balance > 0
      ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let remainingCredit = totalAmount;
      for (const ar of unpaidAR) {
        if (remainingCredit <= 0) break;

        const creditToApply = Math.min(remainingCredit, ar.balance);
        ar.balance -= creditToApply;
        ar.paid_amount = (ar.paid_amount || 0) + creditToApply;
        if (ar.balance <= 0) {
          ar.status = 'PAID';
        }
        remainingCredit -= creditToApply;
        console.log(`[WebMock] Return: Applied ₱${creditToApply} credit to AR ${ar.id}, remaining balance: ₱${ar.balance}`);
      }

      // Update customer balance
      const customer = customers.find(c => c.id === returnData.customer_id);
      if (customer) {
        customer.balance = Math.max(0, (customer.balance || 0) - totalAmount);
        console.log(`[WebMock] Return: Customer ${customer.name} balance reduced to ₱${customer.balance}`);
      }
    }

    // Create eJournal entry
    eJournalEntries.push({
      id: ++eJournalIdCounter,
      entry_type: 'RETURN',
      reference_number: returnNumber,
      description: `Sales return - ${returnData.refund_method} - ${returnData.items.length} items`,
      amount: -totalAmount, // Negative because it's a refund
      cashier_id: returnData.created_by,
      created_at: new Date().toISOString(),
    });

    saveToLocalStorage();
    console.log(`[WebMock] Sales return processed: ${returnNumber}, Total: ₱${totalAmount}`);
    return { returnId, returnNumber };
  }

  public async getSalesReturnsReport(startDate?: string, endDate?: string): Promise<any> {
    let filteredReturns = [...salesReturns];

    if (startDate) {
      filteredReturns = filteredReturns.filter(r => r.created_at >= startDate);
    }
    if (endDate) {
      filteredReturns = filteredReturns.filter(r => r.created_at <= endDate + 'T23:59:59');
    }

    const totalReturns = filteredReturns.length;
    const totalAmount = filteredReturns.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const cashRefunds = filteredReturns.filter(r => r.refund_method === 'CASH').reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const creditRefunds = filteredReturns.filter(r => r.refund_method === 'CREDIT').reduce((sum, r) => sum + (r.total_amount || 0), 0);

    return {
      total_returns: totalReturns,
      total_amount: totalAmount,
      cash_refunds: cashRefunds,
      credit_refunds: creditRefunds,
      returns: filteredReturns,
    };
  }

  // ============ PURCHASE RETURNS ============
  public async getPurchaseReturns(supplierId?: number): Promise<any[]> {
    let result = [...purchaseReturns];
    if (supplierId) {
      result = result.filter(r => r.supplier_id === supplierId);
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getPurchaseReturnItems(returnId: number): Promise<any[]> {
    return purchaseReturnItems.filter(item => item.return_id === returnId);
  }

  public async getPurchaseForReturn(purchaseId: string): Promise<any | null> {
    const purchase = purchases.find(p => p.purchase_id === purchaseId);
    if (purchase) {
      // Include items
      purchase.items = purchaseItems.filter(item => item.purchase_id === purchaseId);
    }
    return purchase || null;
  }

  public async processPurchaseReturn(returnData: {
    original_purchase_id?: string;
    supplier_id: number;
    supplier_name: string;
    items: Array<{
      product_id: number;
      product_name: string;
      quantity: number;
      unit_cost: number;
      reason: string;
    }>;
    refund_method: 'CASH' | 'CREDIT' | 'REPLACEMENT';
    notes?: string;
    created_by: number;
  }): Promise<{ returnId: number; returnNumber: string }> {
    const returnId = ++purchaseReturnIdCounter;
    const returnNumber = `PR-${String(returnId).padStart(6, '0')}`;

    // Calculate total return amount
    const totalAmount = returnData.items.reduce(
      (sum, item) => sum + (item.quantity * item.unit_cost), 0
    );

    // Create return record
    const newReturn = {
      id: returnId,
      return_number: returnNumber,
      original_purchase_id: returnData.original_purchase_id,
      supplier_id: returnData.supplier_id,
      supplier_name: returnData.supplier_name,
      total_amount: totalAmount,
      refund_method: returnData.refund_method,
      notes: returnData.notes,
      status: 'COMPLETED',
      created_by: returnData.created_by,
      created_at: new Date().toISOString(),
    };
    purchaseReturns.push(newReturn);

    // Process each return item
    for (const item of returnData.items) {
      // Add return item record
      purchaseReturnItems.push({
        id: ++purchaseReturnItemIdCounter,
        return_id: returnId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost,
        reason: item.reason,
        created_at: new Date().toISOString(),
      });

      // DECREASE stock (return item to supplier)
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        product.stock_quantity = Math.max(0, (product.stock_quantity || 0) - item.quantity);
        console.log(`[WebMock] Purchase Return: Stock decreased for ${product.name} -${item.quantity} = ${product.stock_quantity}`);

        // Create inventory movement for purchase return
        inventoryMovements.push({
          id: ++inventoryMovementIdCounter,
          product_id: item.product_id,
          movement_type: 'OUT',
          quantity: item.quantity,
          reference_type: 'PURCHASE_RETURN',
          reference_id: returnNumber,
          notes: `Return to supplier: ${item.reason}`,
          created_by: returnData.created_by,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Handle refund based on method
    if (returnData.refund_method === 'CREDIT') {
      // Reduce supplier's outstanding AP balance
      const unpaidAP = accountsPayable.filter(
        ap => ap.supplier_id === returnData.supplier_id && ap.balance > 0
      ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let remainingCredit = totalAmount;
      for (const ap of unpaidAP) {
        if (remainingCredit <= 0) break;

        const creditToApply = Math.min(remainingCredit, ap.balance);
        ap.balance -= creditToApply;
        ap.paid_amount = (ap.paid_amount || 0) + creditToApply;
        if (ap.balance <= 0) {
          ap.status = 'PAID';
        }
        remainingCredit -= creditToApply;
        console.log(`[WebMock] Purchase Return: Applied ₱${creditToApply} credit to AP ${ap.id}, remaining balance: ₱${ap.balance}`);
      }

      // Note: We don't track supplier balance separately, AP records are the source of truth
      console.log(`[WebMock] Purchase Return: Supplier ${returnData.supplier_name} AP reduced by ₱${totalAmount}`);
    }

    // Create eJournal entry
    eJournalEntries.push({
      id: ++eJournalIdCounter,
      entry_type: 'PURCHASE_RETURN',
      reference_number: returnNumber,
      description: `Purchase return to ${returnData.supplier_name} - ${returnData.refund_method} - ${returnData.items.length} items`,
      amount: -totalAmount, // Negative because it reduces what we owe
      cashier_id: returnData.created_by,
      created_at: new Date().toISOString(),
    });

    saveToLocalStorage();
    console.log(`[WebMock] Purchase return processed: ${returnNumber}, Total: ₱${totalAmount}`);
    return { returnId, returnNumber };
  }

  public async getPurchaseReturnsReport(startDate?: string, endDate?: string): Promise<any> {
    let filteredReturns = [...purchaseReturns];

    if (startDate) {
      filteredReturns = filteredReturns.filter(r => r.created_at >= startDate);
    }
    if (endDate) {
      filteredReturns = filteredReturns.filter(r => r.created_at <= endDate + 'T23:59:59');
    }

    const totalReturns = filteredReturns.length;
    const totalAmount = filteredReturns.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const cashRefunds = filteredReturns.filter(r => r.refund_method === 'CASH').reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const creditRefunds = filteredReturns.filter(r => r.refund_method === 'CREDIT').reduce((sum, r) => sum + (r.total_amount || 0), 0);

    return {
      total_returns: totalReturns,
      total_amount: totalAmount,
      cash_refunds: cashRefunds,
      credit_refunds: creditRefunds,
      returns: filteredReturns,
    };
  }

  // ============ END OF DAY / Z-READING ============
  public async getEndOfDayRecords(): Promise<any[]> {
    return [...endOfDayRecords].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public async getEndOfDayByDate(date: string): Promise<any | null> {
    return endOfDayRecords.find(eod => eod.date === date) || null;
  }

  public async saveEndOfDay(eodData: any): Promise<number> {
    const eodId = ++eodIdCounter;

    const newEod = {
      ...eodData,
      id: eodId,
      reading_number: `Z-${String(eodId).padStart(6, '0')}`,
      created_at: new Date().toISOString(),
    };

    endOfDayRecords.push(newEod);

    // Create eJournal entry for Z-Reading
    eJournalEntries.push({
      id: ++eJournalIdCounter,
      entry_type: 'Z_READING',
      reference_number: newEod.reading_number,
      description: `Z-Reading: Net Sales ₱${eodData.net_sales?.toFixed(2)}, Variance ₱${eodData.cash_variance?.toFixed(2)}`,
      amount: eodData.net_sales || 0,
      cashier_id: eodData.created_by,
      created_at: new Date().toISOString(),
    });

    saveToLocalStorage();
    console.log(`[WebMock] End of Day saved: ${newEod.reading_number}`);
    return eodId;
  }

  public async generateZReading(cashierId: number): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t =>
      t.created_at?.startsWith(today) && t.status === 'COMPLETED'
    );

    // Get today's returns
    const todayReturns = salesReturns.filter(r => r.created_at?.startsWith(today));
    const todayReturnsAmount = todayReturns
      .filter(r => r.refund_method === 'CASH')
      .reduce((sum, r) => sum + (r.total_amount || 0), 0);

    // Get voids
    const voidedTransactions = transactions.filter(t =>
      t.created_at?.startsWith(today) && t.status === 'VOID'
    );

    const grossSales = todayTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const discounts = todayTransactions.reduce((sum, t) => sum + (t.discount_amount || 0), 0);
    const netSales = grossSales - discounts;
    const vatAmount = netSales * 0.12 / 1.12;
    const vatSales = netSales - vatAmount;

    const cashSales = todayTransactions
      .filter(t => t.payment_method === 'CASH')
      .reduce((sum, t) => sum + (t.total_amount || 0), 0);

    // Get invoice range
    const invoiceNumbers = todayTransactions
      .map(t => t.transaction_number || t.invoice_number)
      .filter(Boolean)
      .sort();

    const zReading = {
      id: eodIdCounter + 1,
      reading_number: eodIdCounter + 1,
      date: today,
      start_invoice_number: invoiceNumbers[0] || 'N/A',
      end_invoice_number: invoiceNumbers[invoiceNumbers.length - 1] || 'N/A',
      gross_sales: grossSales,
      vat_sales: vatSales,
      vat_exempt: 0,
      vat_amount: vatAmount,
      discount_amount: discounts,
      returns_amount: todayReturnsAmount,
      void_amount: voidedTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0),
      void_count: voidedTransactions.length,
      net_sales: netSales,
      cash_sales: cashSales,
      credit_sales: todayTransactions.filter(t => t.payment_method === 'CHARGE_INVOICE').reduce((sum, t) => sum + (t.total_amount || 0), 0),
      gcash_sales: todayTransactions.filter(t => t.payment_method === 'ONLINE').reduce((sum, t) => sum + (t.total_amount || 0), 0),
      card_sales: todayTransactions.filter(t => t.payment_method === 'CARD').reduce((sum, t) => sum + (t.total_amount || 0), 0),
      transaction_count: todayTransactions.length,
      reset_counter: eodIdCounter,
      cashier_id: cashierId,
      generated_at: new Date().toISOString(),
    };

    return zReading;
  }

  public async generateXReading(cashierId: number): Promise<any> {
    // X-Reading is same as Z-Reading but doesn't reset counters
    const zReading = await this.generateZReading(cashierId);
    return {
      ...zReading,
      reading_type: 'X',
      is_inquiry: true,
    };
  }

  public getDatabase(): any {
    // Return a mock database object for web that handles common operations
    const self = this;
    return {
      withTransactionAsync: async (callback: () => Promise<void>) => {
        // Just execute the callback - no real transaction on web
        await callback();
      },
      runAsync: async (sql: string, params: any[] = []) => {
        // Parse SQL and route to appropriate mock method
        console.log('[WebMock] runAsync called:', sql.substring(0, 50) + '...');

        // Handle INSERT INTO inventory_movements
        if (sql.toLowerCase().includes('insert into inventory_movements')) {
          const movement = {
            product_id: params[0],
            movement_type: params[1],
            quantity: params[2],
            reference_type: params[3],
            notes: params[4],
            created_by: params[5]
          };
          await self.createInventoryMovement(movement);
          return { lastInsertRowId: inventoryMovementIdCounter - 1 };
        }

        // Handle UPDATE products SET stock_quantity
        if (sql.toLowerCase().includes('update products set stock_quantity')) {
          const quantity = params[0];
          const productId = params[1];
          const product = products.find(p => p.id === productId);
          if (product) {
            product.stock_quantity = quantity;
            saveToLocalStorage();
            console.log('[WebMock] Updated product stock:', productId, '→', quantity);
          }
          return { changes: 1 };
        }

        console.log('[WebMock] Unhandled SQL:', sql);
        return { lastInsertRowId: 0, changes: 0 };
      },
      getAllAsync: async (sql: string, params: any[] = []) => {
        console.log('[WebMock] getAllAsync called:', sql.substring(0, 50) + '...');
        return [];
      },
      getFirstAsync: async (sql: string, params: any[] = []) => {
        console.log('[WebMock] getFirstAsync called:', sql.substring(0, 50) + '...');
        return null;
      }
    };
  }
}
