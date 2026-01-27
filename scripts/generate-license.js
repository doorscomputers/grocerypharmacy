/**
 * License Key Generator for IgoroTech POS
 *
 * Usage: node scripts/generate-license.js <deviceId>
 *
 * This script generates a license key for a specific device.
 * Each license key is mathematically tied to the device ID and
 * will only work on that specific device.
 */

const crypto = require('crypto');

// This must match the MASTER_SECRET in DeviceBindingService.ts
const MASTER_SECRET = 'IGOROTECH-POS-2024-SECRET-KEY';

function generateLicenseKey(deviceId) {
  const combined = `${deviceId}|${MASTER_SECRET}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  const shortHash = hash.substring(0, 16).toUpperCase();
  const parts = shortHash.match(/.{1,4}/g) || [];
  return parts.slice(0, 4).join('-');
}

// Get device ID from command line argument
const deviceId = process.argv[2];

if (!deviceId) {
  console.log('\n========================================');
  console.log('  IgoroTech POS License Key Generator');
  console.log('========================================\n');
  console.log('Usage: node scripts/generate-license.js <deviceId>\n');
  console.log('Example:');
  console.log('  node scripts/generate-license.js 816299459fa626426a7044df9f3abc123def456789\n');
  console.log('The device ID is shown on the customer\'s activation screen.');
  console.log('They can copy it and send it to you via WhatsApp, SMS, or Email.\n');
  process.exit(1);
}

// Clean the device ID (remove any whitespace or dashes that might have been copied)
const cleanDeviceId = deviceId.replace(/[\s-]/g, '');

console.log('\n========================================');
console.log('  License Key Generated Successfully');
console.log('========================================\n');
console.log('Device ID:', cleanDeviceId.length > 40
  ? cleanDeviceId.substring(0, 20) + '...' + cleanDeviceId.substring(cleanDeviceId.length - 10)
  : cleanDeviceId);
console.log('License Key:', generateLicenseKey(cleanDeviceId));
console.log('\nSend this license key to your customer.');
console.log('They should enter it on the activation screen and tap "Activate Device".\n');
