import { DatabaseService } from '../database/DatabaseService';

export const initializeSampleData = async () => {
  try {
    const dbService = DatabaseService.getInstance();

    // Sample products
    const sampleProducts = [
      {
        code: 'ITEM001',
        name: 'Coca Cola 330ml',
        description: 'Refreshing cola drink',
        price: 25.00,
        cost: 18.00,
        stock_quantity: 100,
        unit: 'pcs',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM002',
        name: 'White Bread',
        description: 'Fresh white bread loaf',
        price: 45.00,
        cost: 32.00,
        stock_quantity: 50,
        unit: 'loaf',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM003',
        name: 'Instant Noodles',
        description: 'Chicken flavor instant noodles',
        price: 15.00,
        cost: 12.00,
        stock_quantity: 200,
        unit: 'pack',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM004',
        name: 'Mineral Water 500ml',
        description: 'Pure mineral water',
        price: 12.00,
        cost: 8.00,
        stock_quantity: 150,
        unit: 'bottle',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM005',
        name: 'Rice 25kg',
        description: 'Premium jasmine rice',
        price: 1800.00,
        cost: 1500.00,
        stock_quantity: 25,
        unit: 'sack',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM006',
        name: 'Cooking Oil 1L',
        description: 'Vegetable cooking oil',
        price: 85.00,
        cost: 70.00,
        stock_quantity: 80,
        unit: 'bottle',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM007',
        name: 'Banana Chips',
        description: 'Crispy banana chips',
        price: 35.00,
        cost: 25.00,
        stock_quantity: 60,
        unit: 'pack',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM008',
        name: 'Detergent Powder',
        description: 'Laundry detergent powder',
        price: 120.00,
        cost: 95.00,
        stock_quantity: 40,
        unit: 'box',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM009',
        name: 'Shampoo 200ml',
        description: 'Anti-dandruff shampoo',
        price: 89.00,
        cost: 65.00,
        stock_quantity: 35,
        unit: 'bottle',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
      {
        code: 'ITEM010',
        name: 'Toothpaste',
        description: 'Fluoride toothpaste',
        price: 45.00,
        cost: 32.00,
        stock_quantity: 45,
        unit: 'tube',
        tax_rate: 12.00,
        is_vat_inclusive: true,
      },
    ];

    // Add sample products
    for (const product of sampleProducts) {
      try {
        await dbService.createProduct(product);
        console.log(`Added product: ${product.name}`);
      } catch (error) {
        // Product might already exist
        console.log(`Product ${product.name} already exists or error occurred:`, error);
      }
    }

    // Verify products were added
    const addedProducts = await dbService.getProducts();
    console.log(`Total products in database: ${addedProducts.length}`);

    // Update company settings with Philippine sample data
    await dbService.updateSetting('company_name', 'Sample Sari-Sari Store');
    await dbService.updateSetting('company_address', '123 Rizal Street, Barangay San Jose, Quezon City, Metro Manila');
    await dbService.updateSetting('company_tin', '123-456-789-000');
    await dbService.updateSetting('bir_permit', 'FP-123456789-000');
    await dbService.updateSetting('pos_serial', 'POS2024001');
    await dbService.updateSetting('accreditation_number', 'ACC2024001');
    await dbService.updateSetting('receipt_footer', 'Salamat sa inyong pagbili!\nVisit us again soon!');

    console.log('Sample data initialized successfully');
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
};

export const clearAllData = async () => {
  try {
    const dbService = DatabaseService.getInstance();
    const db = dbService.getDatabase();

    // Clear all tables (be careful with this in production!)
    await db.execAsync(`
      DELETE FROM transaction_items;
      DELETE FROM transactions;
      DELETE FROM inventory_movements;
      DELETE FROM ejournal;
      DELETE FROM z_readings;
      DELETE FROM x_readings;
      DELETE FROM products;
      DELETE FROM categories;

      -- Reset auto-increment counters
      DELETE FROM sqlite_sequence WHERE name IN (
        'transaction_items', 'transactions', 'inventory_movements',
        'ejournal', 'z_readings', 'x_readings', 'products', 'categories'
      );

      -- Reset invoice counter
      UPDATE settings SET value = '1' WHERE key = 'current_invoice_number';
      UPDATE settings SET value = '0' WHERE key = 'z_counter';
    `);

    console.log('All data cleared successfully');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};