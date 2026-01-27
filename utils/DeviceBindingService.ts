/**
 * Device Binding Service
 * Handles device registration, validation, and license key verification
 */

import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { getDeviceFingerprint, getDeviceInfo, DeviceInfo } from './DeviceService';
import { DeviceBinding } from '../database/schema';

// Master secret key - In production, this should be stored securely
// You should change this to your own secret key
const MASTER_SECRET = 'IGOROTECH-POS-2024-SECRET-KEY';

export interface ActivationResult {
  success: boolean;
  message: string;
  deviceBinding?: DeviceBinding;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  deviceBinding?: DeviceBinding;
}

/**
 * DeviceBindingService - Singleton service for device licensing
 */
class DeviceBindingServiceClass {
  private db: any = null;

  /**
   * Initialize the service with database instance
   */
  initialize(database: any) {
    this.db = database;
  }

  /**
   * Check if device is already activated
   */
  async isDeviceActivated(): Promise<boolean> {
    if (Platform.OS === 'web') {
      // Web platform doesn't support device binding
      return true;
    }

    try {
      const deviceId = await getDeviceFingerprint();
      const binding = await this.getDeviceBinding(deviceId);
      return binding !== null && binding.is_active;
    } catch (error) {
      console.error('Error checking device activation:', error);
      return false;
    }
  }

  /**
   * Get device binding record from database
   */
  async getDeviceBinding(deviceId: string): Promise<DeviceBinding | null> {
    if (!this.db) {
      throw new Error('DeviceBindingService not initialized with database');
    }

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM device_binding WHERE device_id = ? AND is_active = 1',
        [deviceId]
      ) as DeviceBinding | null;
      return result || null;
    } catch (error) {
      console.error('Error getting device binding:', error);
      return null;
    }
  }

  /**
   * Generate a valid license key for a given device ID
   * This is used by the seller to generate keys for customers
   */
  async generateLicenseKey(deviceId: string): Promise<string> {
    const combined = `${deviceId}|${MASTER_SECRET}`;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );

    // Take first 16 characters and format as XXXX-XXXX-XXXX-XXXX
    const shortHash = hash.substring(0, 16).toUpperCase();
    return this.formatLicenseKey(shortHash);
  }

  /**
   * Validate if a license key is valid for the current device
   */
  async validateLicenseKey(licenseKey: string): Promise<boolean> {
    try {
      const deviceId = await getDeviceFingerprint();
      const expectedKey = await this.generateLicenseKey(deviceId);

      // Normalize both keys for comparison
      const normalizedInput = licenseKey.replace(/[-\s]/g, '').toUpperCase();
      const normalizedExpected = expectedKey.replace(/[-\s]/g, '').toUpperCase();

      return normalizedInput === normalizedExpected;
    } catch (error) {
      console.error('Error validating license key:', error);
      return false;
    }
  }

  /**
   * Activate device with license key
   */
  async activateDevice(licenseKey: string): Promise<ActivationResult> {
    if (Platform.OS === 'web') {
      return {
        success: true,
        message: 'Web platform - activation not required',
      };
    }

    if (!this.db) {
      return {
        success: false,
        message: 'Database not initialized',
      };
    }

    try {
      // Validate the license key
      const isValid = await this.validateLicenseKey(licenseKey);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid license key. Please check and try again.',
        };
      }

      // Get device info
      const deviceInfo = await getDeviceInfo();

      // Check if device is already activated
      const existingBinding = await this.getDeviceBinding(deviceInfo.deviceId);
      if (existingBinding) {
        // Update last verified timestamp
        await this.db.runAsync(
          'UPDATE device_binding SET last_verified_at = CURRENT_TIMESTAMP WHERE device_id = ?',
          [deviceInfo.deviceId]
        );

        return {
          success: true,
          message: 'Device already activated',
          deviceBinding: existingBinding,
        };
      }

      // Create new device binding
      const normalizedKey = licenseKey.replace(/[-\s]/g, '').toUpperCase();
      await this.db.runAsync(
        `INSERT INTO device_binding
         (device_id, license_key, device_name, device_brand, device_model, os_name, os_version, app_version, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          deviceInfo.deviceId,
          normalizedKey,
          deviceInfo.deviceName,
          deviceInfo.brand,
          deviceInfo.modelName,
          deviceInfo.osName,
          deviceInfo.osVersion,
          deviceInfo.appVersion,
        ]
      );

      // Retrieve the created binding
      const newBinding = await this.getDeviceBinding(deviceInfo.deviceId);

      return {
        success: true,
        message: 'Device activated successfully!',
        deviceBinding: newBinding || undefined,
      };
    } catch (error) {
      console.error('Error activating device:', error);
      return {
        success: false,
        message: `Activation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Verify device on app startup
   */
  async verifyDevice(): Promise<ValidationResult> {
    if (Platform.OS === 'web') {
      return {
        isValid: true,
        message: 'Web platform - verification skipped',
      };
    }

    if (!this.db) {
      return {
        isValid: false,
        message: 'Database not initialized',
      };
    }

    try {
      const deviceId = await getDeviceFingerprint();
      const binding = await this.getDeviceBinding(deviceId);

      if (!binding) {
        return {
          isValid: false,
          message: 'Device not activated. Please enter your license key.',
        };
      }

      if (!binding.is_active) {
        return {
          isValid: false,
          message: 'Device license has been deactivated.',
        };
      }

      // Update last verified timestamp
      await this.db.runAsync(
        'UPDATE device_binding SET last_verified_at = CURRENT_TIMESTAMP WHERE device_id = ?',
        [deviceId]
      );

      return {
        isValid: true,
        message: 'Device verified successfully',
        deviceBinding: binding,
      };
    } catch (error) {
      console.error('Error verifying device:', error);
      return {
        isValid: false,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Deactivate device (for admin use)
   */
  async deactivateDevice(deviceId: string): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      await this.db.runAsync(
        'UPDATE device_binding SET is_active = 0 WHERE device_id = ?',
        [deviceId]
      );
      return true;
    } catch (error) {
      console.error('Error deactivating device:', error);
      return false;
    }
  }

  /**
   * Get current device ID (for displaying to user)
   */
  async getCurrentDeviceId(): Promise<string> {
    if (Platform.OS === 'web') {
      return 'WEB-PLATFORM';
    }
    return await getDeviceFingerprint();
  }

  /**
   * Format license key as XXXX-XXXX-XXXX-XXXX
   */
  private formatLicenseKey(key: string): string {
    const cleaned = key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.slice(0, 4).join('-');
  }
}

// Export singleton instance
export const DeviceBindingService = new DeviceBindingServiceClass();
