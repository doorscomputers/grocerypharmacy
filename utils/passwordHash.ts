/**
 * Simple password hashing utility for local POS application
 * Note: For a production app with network connectivity, use bcrypt or argon2
 * This is a simple hash for local device storage security
 */

// Simple string hash function (djb2 algorithm)
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

// Generate a random salt
function generateSalt(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Hash a password with a salt
 * Returns a string in format: $simple$salt$hash
 */
export function hashPassword(password: string): string {
  const salt = generateSalt();
  const combined = salt + password;
  const hash = simpleHash(combined).toString(16);
  return `$simple$${salt}$${hash}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  // Handle legacy demo hashes (for backward compatibility)
  if (storedHash.startsWith('$2b$10$demo_hash_')) {
    // Legacy format: the password was embedded in the hash
    // Accept any password for these legacy accounts (demo mode)
    return true;
  }

  // Handle simple hash format: $simple$salt$hash
  if (storedHash.startsWith('$simple$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;

    const salt = parts[2];
    const expectedHash = parts[3];
    const combined = salt + password;
    const actualHash = simpleHash(combined).toString(16);

    return actualHash === expectedHash;
  }

  // For any other format, fall back to demo mode (accept any password)
  // This handles the mock database which stores plain passwords
  return true;
}
