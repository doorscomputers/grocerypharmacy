const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
function randomPrice(min = 10, max = 2000) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Function to generate random stock
function randomStock(min = 0, max = 500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to get random element from array
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Function to generate unique product code
function generateProductCode(index) {
  return `PRD${(index + 1).toString().padStart(6, '0')}`;
}

// Function to generate product name
function generateProductName(index) {
  const prefix = randomElement(productPrefixes);
  const name = randomElement(productNames);
  const suffix = Math.random() > 0.7 ? ` ${randomElement(['Plus', 'Max', 'Pro', 'Lite', 'XL', 'Mini'])}` : '';
  return `${prefix} ${name}${suffix} ${index + 1}`;
}

function generateProducts(count) {
  const products = [];

  for (let i = 0; i < count; i++) {
    const price = randomPrice();
    const cost = Math.round(price * (0.6 + Math.random() * 0.3) * 100) / 100; // Cost is 60-90% of price
    const isVatInclusive = Math.random() > 0.3; // 70% chance of VAT inclusive

    const product = {
      code: generateProductCode(i),
      name: generateProductName(i),
      description: `High quality ${randomElement(productNames).toLowerCase()} for everyday use`,
      price: price,
      cost: cost,
      category_id: Math.floor(i % categories.length) + 1, // Cycle through categories
      tax_rate: 12.00,
      is_vat_inclusive: isVatInclusive ? 1 : 0,
      stock_quantity: randomStock(),
      unit: randomElement(units),
      is_active: 1
    };

    products.push(product);
  }

  return products;
}

async function insertProducts() {
  const dbPath = path.join(__dirname, '..', 'grocerypos.db');

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // First, insert categories if they don't exist
    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO categories (name, description, is_active)
      VALUES (?, ?, 1)
    `);

    categories.forEach((category, index) => {
      insertCategory.run(category, `${category} products and items`);
    });
    insertCategory.finalize();

    // Generate 5000 products
    console.log('Generating 5000 unique products...');
    const products = generateProducts(5000);

    // Prepare insert statement
    const insertProduct = db.prepare(`
      INSERT OR REPLACE INTO products
      (code, name, description, price, cost, category_id, tax_rate, is_vat_inclusive, stock_quantity, unit, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert products in batches
    console.log('Inserting products into database...');
    let inserted = 0;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      products.forEach((product, index) => {
        insertProduct.run([
          product.code,
          product.name,
          product.description,
          product.price,
          product.cost,
          product.category_id,
          product.tax_rate,
          product.is_vat_inclusive,
          product.stock_quantity,
          product.unit,
          product.is_active
        ], function(err) {
          if (err) {
            console.error(`Error inserting product ${index + 1}:`, err);
          } else {
            inserted++;
          }
        });

        if ((index + 1) % 1000 === 0) {
          console.log(`Inserted ${index + 1} products...`);
        }
      });

      db.run('COMMIT', (err) => {
        if (err) {
          reject(err);
        } else {
          insertProduct.finalize();
          console.log(`Successfully inserted ${inserted} products!`);

          // Verify count
          db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
            if (err) {
              reject(err);
            } else {
              console.log(`Total products in database: ${row.count}`);
              db.close();
              resolve(row.count);
            }
          });
        }
      });
    });
  });
}

// Run the script
if (require.main === module) {
  insertProducts()
    .then((count) => {
      console.log(`Operation completed. Database now has ${count} products.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { insertProducts, generateProducts };