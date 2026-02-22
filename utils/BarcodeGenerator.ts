import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/getDatabase';

const BARCODE_SEQUENCE_KEY = '@barcode_sequence_number';

/**
 * Barcode Generator Utility
 * Generates unique CODE128 barcodes for products
 */

/**
 * Get the next barcode sequence number from AsyncStorage
 */
export async function getNextBarcodeSequence(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(BARCODE_SEQUENCE_KEY);
    if (value === null) {
      return 1; // Start from 1 if no sequence exists
    }
    return parseInt(value, 10) + 1;
  } catch (error) {
    console.error('Error getting barcode sequence:', error);
    return 1;
  }
}

/**
 * Save barcode sequence number to AsyncStorage
 */
export async function saveBarcodeSequence(num: number): Promise<void> {
  try {
    await AsyncStorage.setItem(BARCODE_SEQUENCE_KEY, num.toString());
  } catch (error) {
    console.error('Error saving barcode sequence:', error);
    throw error;
  }
}

/**
 * Check if a product code already exists in the database
 */
async function codeExists(code: string): Promise<boolean> {
  try {
    const db = getDatabase();
    const result = db.getAllSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM products WHERE UPPER(TRIM(code)) = UPPER(TRIM(?))',
      [code]
    );
    return result.length > 0 && result[0].count > 0;
  } catch (error) {
    console.error('Error checking code existence:', error);
    return false;
  }
}

/**
 * Generate a unique product code with specified prefix
 * Format: P000001, P000002, etc.
 *
 * @param prefix - Prefix for the barcode (default: 'P')
 * @returns Promise<string> - Unique product code
 */
export async function generateProductCode(prefix: string = 'P'): Promise<string> {
  const maxAttempts = 100;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // Get next sequence number
      const sequence = await getNextBarcodeSequence();

      // Format with zero-padding (6 digits)
      const paddedSequence = sequence.toString().padStart(6, '0');
      const code = `${prefix}${paddedSequence}`;

      // Check if this code already exists
      const exists = await codeExists(code);

      if (!exists) {
        // Save the sequence number for next time
        await saveBarcodeSequence(sequence);
        return code;
      }

      // If code exists, increment and try again
      await saveBarcodeSequence(sequence);
      attempt++;
    } catch (error) {
      console.error('Error generating product code:', error);
      throw new Error('Failed to generate unique product code');
    }
  }

  throw new Error('Unable to generate unique product code after maximum attempts');
}

/**
 * Validate if a string is compatible with CODE128 format
 * CODE128 supports: 0-9, A-Z, a-z, and special characters
 *
 * @param code - Code to validate
 * @returns boolean - True if valid CODE128 format
 */
export function validateCode128(code: string): boolean {
  if (!code || code.trim() === '') {
    return false;
  }

  // CODE128 supports ASCII characters 0-127
  // Most common are alphanumeric and basic special characters
  const validPattern = /^[\x20-\x7E]+$/; // Printable ASCII characters

  if (!validPattern.test(code)) {
    return false;
  }

  // Additional check: reasonable length (1-48 characters)
  // Longer barcodes may not scan well or fit on labels
  if (code.length < 1 || code.length > 48) {
    return false;
  }

  return true;
}

/**
 * Reset barcode sequence to a specific number
 * Useful for testing or administrative purposes
 *
 * @param num - Number to reset sequence to
 */
export async function resetBarcodeSequence(num: number = 0): Promise<void> {
  try {
    await AsyncStorage.setItem(BARCODE_SEQUENCE_KEY, num.toString());
  } catch (error) {
    console.error('Error resetting barcode sequence:', error);
    throw error;
  }
}

/**
 * Get current barcode sequence number (without incrementing)
 */
export async function getCurrentBarcodeSequence(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(BARCODE_SEQUENCE_KEY);
    if (value === null) {
      return 0;
    }
    return parseInt(value, 10);
  } catch (error) {
    console.error('Error getting current barcode sequence:', error);
    return 0;
  }
}
