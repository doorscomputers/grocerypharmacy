import * as SQLite from 'expo-sqlite';
import { DatabaseService } from '../database/DatabaseService';

// Categories for products
const categories = [
  'Beverages', 'Food & Snacks', 'Personal Care', 'Household Items',
  'Electronics', 'Clothing', 'Books & Stationery', 'Health & Beauty',
  'Sports & Recreation', 'Tools & Hardware', 'Automotive', 'Pet Supplies',
  'Toys & Games', 'Garden & Outdoor', 'Office Supplies'
];

// Product name prefixes and suffixes
const productPrefixes = [
  'Premium', 'Classic', 'Super', 'Mega', 'Ultra', 'Pro', 'Deluxe', 'Standard',
  'Basic', 'Economy', 'Family', 'Industrial', 'Commercial', 'Professional',
  'Advanced', 'Essential', 'Original', 'Natural', 'Organic', 'Fresh'
];

const productNames = [
  'Cola', 'Water', 'Juice', 'Coffee', 'Tea', 'Bread', 'Rice', 'Noodles',
  'Soap', 'Shampoo', 'Toothpaste', 'Battery', 'Cable', 'Charger', 'Shirt',
  'Pants', 'Shoes', 'Notebook', 'Pen', 'Pencil', 'Cream', 'Lotion', 'Oil',
  'Ball', 'Racket', 'Tool', 'Hammer', 'Screwdriver', 'Wrench', 'Filter',
  'Cleaner', 'Polish', 'Food', 'Treats', 'Toy', 'Game', 'Plant', 'Fertilizer',
  'Paper', 'Folder', 'Stapler', 'Clips', 'Tape', 'Glue', 'Marker', 'Highlighter'
];

const units = ['pcs', 'box', 'pack', 'bottle', 'can', 'bag', 'kg', 'lbs', 'set', 'roll'];

// Function to generate random price
function randomPrice(min = 10, max = 2000): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Function to generate random stock
function randomStock(min = 0, max = 500): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to get random element from array
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Function to generate unique product code
function generateProductCode(index: number): string {
  return `PRD${(index + 1).toString().padStart(6, '0')}`;
}

// Function to generate product name
function generateProductName(index: number): string {
  const prefix = randomElement(productPrefixes);
  const name = randomElement(productNames);
  const suffix = Math.random() > 0.7 ? ` ${randomElement(['Plus', 'Max', 'Pro', 'Lite', 'XL', 'Mini'])}` : '';
  return `${prefix} ${name}${suffix}`;
}

interface TestProduct {
  code: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  category_id: number;
  tax_rate: number;
  is_vat_inclusive: boolean;
  stock_quantity: number;
  unit: string;
}

function generateProducts(count: number): TestProduct[] {
  const products: TestProduct[] = [];

  for (let i = 0; i < count; i++) {
    const price = randomPrice();
    const cost = Math.round(price * (0.6 + Math.random() * 0.3) * 100) / 100; // Cost is 60-90% of price
    const isVatInclusive = Math.random() > 0.3; // 70% chance of VAT inclusive

    const product: TestProduct = {
      code: generateProductCode(i),
      name: generateProductName(i),
      description: `High quality ${randomElement(productNames).toLowerCase()} for everyday use`,
      price: price,
      cost: cost,
      category_id: (i % categories.length) + 1, // Cycle through categories
      tax_rate: 12.00,
      is_vat_inclusive: isVatInclusive,
      stock_quantity: randomStock(),
      unit: randomElement(units)
    };

    products.push(product);
  }

  return products;
}

export async function insertTestProducts(): Promise<number> {
  const dbService = DatabaseService.getInstance();
  await dbService.initialize();
  const db = dbService.getDatabase();

  console.log('Adding categories...');

  // First, insert categories if they don't exist
  for (let i = 0; i < categories.length; i++) {
    try {
      await db.runAsync(
        `INSERT OR IGNORE INTO categories (name, description, is_active) VALUES (?, ?, 1)`,
        [categories[i], `${categories[i]} products and items`]
      );
    } catch (error) {
      console.error(`Error inserting category ${categories[i]}:`, error);
    }
  }

  console.log('Generating 5000 unique products...');
  const products = generateProducts(5000);

  console.log('Inserting products into database...');
  let inserted = 0;

  // Insert products in batches of 100
  const batchSize = 100;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    try {
      await db.execAsync('BEGIN TRANSACTION');

      for (const product of batch) {
        try {
          await db.runAsync(
            `INSERT OR REPLACE INTO products
             (code, name, description, price, cost, category_id, tax_rate, is_vat_inclusive, stock_quantity, unit, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              product.code,
              product.name,
              product.description,
              product.price,
              product.cost,
              product.category_id,
              product.tax_rate,
              product.is_vat_inclusive ? 1 : 0,
              product.stock_quantity,
              product.unit
            ]
          );
          inserted++;
        } catch (error) {
          console.error(`Error inserting product ${product.code}:`, error);
        }
      }

      await db.execAsync('COMMIT');
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)} (${inserted} total products)`);

    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
    }
  }

  // Verify count
  const result = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM products');
  const totalCount = result?.count || 0;

  console.log(`Successfully inserted ${inserted} new products!`);
  console.log(`Total products in database: ${totalCount}`);

  return totalCount;
}

// Export for use in other files
export { generateProducts };