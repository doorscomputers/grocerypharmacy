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

export interface TrialStatus {
  isTrialActive: boolean;
  isTrialExpired: boolean;
  isFullLicense: boolean;
  daysRemaining: number;
  licenseType: 'trial' | 'full' | 'none';
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

      // Check if device already has a binding (trial or full)
      const existingBinding = await this.getDeviceBinding(deviceInfo.deviceId);
      const normalizedKey = licenseKey.replace(/[-\s]/g, '').toUpperCase();

      if (existingBinding) {
        // Upgrade existing binding to full license
        await this.db.runAsync(
          `UPDATE device_binding
           SET license_key = ?, license_type = 'full', activated_at = CURRENT_TIMESTAMP, last_verified_at = CURRENT_TIMESTAMP
           WHERE device_id = ?`,
          [normalizedKey, deviceInfo.deviceId]
        );

        const updatedBinding = await this.getDeviceBinding(deviceInfo.deviceId);
        return {
          success: true,
          message: 'Device upgraded to full license!',
          deviceBinding: updatedBinding || undefined,
        };
      }

      // Create new device binding with full license
      await this.db.runAsync(
        `INSERT INTO device_binding
         (device_id, license_key, device_name, device_brand, device_model, os_name, os_version, app_version, is_active, license_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'full')`,
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
   * Returns valid if: full license OR trial is still active
   * Returns invalid if: no binding OR trial expired OR deactivated
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

      // No binding - start trial automatically
      if (!binding) {
        const trialResult = await this.startTrial();
        if (trialResult.success) {
          return {
            isValid: true,
            message: 'Trial started! You have 30 days to try the app.',
            deviceBinding: trialResult.deviceBinding,
          };
        }
        return {
          isValid: false,
          message: 'Failed to start trial. Please contact support.',
        };
      }

      if (!binding.is_active) {
        return {
          isValid: false,
          message: 'Device license has been deactivated.',
        };
      }

      // Check trial status
      const trialStatus = await this.getTrialStatus();

      // Full license - always valid
      if (trialStatus.isFullLicense) {
        await this.db.runAsync(
          'UPDATE device_binding SET last_verified_at = CURRENT_TIMESTAMP WHERE device_id = ?',
          [deviceId]
        );
        return {
          isValid: true,
          message: 'Device verified successfully',
          deviceBinding: binding,
        };
      }

      // Trial expired - require license
      if (trialStatus.isTrialExpired) {
        return {
          isValid: false,
          message: 'Your 30-day trial has expired. Please enter a license key to continue.',
          deviceBinding: binding,
        };
      }

      // Trial still active
      await this.db.runAsync(
        'UPDATE device_binding SET last_verified_at = CURRENT_TIMESTAMP WHERE device_id = ?',
        [deviceId]
      );

      return {
        isValid: true,
        message: `Trial active - ${trialStatus.daysRemaining} days remaining`,
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

  // ===== TRIAL VERSION METHODS =====

  /**
   * Start a trial for the current device (auto-starts on first launch)
   */
  async startTrial(): Promise<ActivationResult> {
    if (Platform.OS === 'web') {
      return {
        success: true,
        message: 'Web platform - trial not required',
      };
    }

    if (!this.db) {
      return {
        success: false,
        message: 'Database not initialized',
      };
    }

    try {
      const deviceInfo = await getDeviceInfo();

      // Check if device already has a binding
      const existingBinding = await this.getDeviceBinding(deviceInfo.deviceId);
      if (existingBinding) {
        return {
          success: true,
          message: existingBinding.license_type === 'full' ? 'Device already licensed' : 'Trial already active',
          deviceBinding: existingBinding,
        };
      }

      // Create new trial binding
      await this.db.runAsync(
        `INSERT INTO device_binding
         (device_id, license_key, device_name, device_brand, device_model, os_name, os_version, app_version, is_active, license_type, trial_start_date, trial_days)
         VALUES (?, '', ?, ?, ?, ?, ?, ?, 1, 'trial', CURRENT_TIMESTAMP, 30)`,
        [
          deviceInfo.deviceId,
          deviceInfo.deviceName,
          deviceInfo.brand,
          deviceInfo.modelName,
          deviceInfo.osName,
          deviceInfo.osVersion,
          deviceInfo.appVersion,
        ]
      );

      const newBinding = await this.getDeviceBinding(deviceInfo.deviceId);

      return {
        success: true,
        message: 'Trial started! You have 30 days to try the app.',
        deviceBinding: newBinding || undefined,
      };
    } catch (error) {
      console.error('Error starting trial:', error);
      return {
        success: false,
        message: `Failed to start trial: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get trial status for the current device
   */
  async getTrialStatus(): Promise<TrialStatus> {
    if (Platform.OS === 'web') {
      return {
        isTrialActive: false,
        isTrialExpired: false,
        isFullLicense: true,
        daysRemaining: 0,
        licenseType: 'full',
      };
    }

    try {
      const deviceId = await getDeviceFingerprint();
      const binding = await this.getDeviceBinding(deviceId);

      if (!binding) {
        return {
          isTrialActive: false,
          isTrialExpired: false,
          isFullLicense: false,
          daysRemaining: 0,
          licenseType: 'none',
        };
      }

      // Full license - no trial concerns
      if (binding.license_type === 'full') {
        return {
          isTrialActive: false,
          isTrialExpired: false,
          isFullLicense: true,
          daysRemaining: 0,
          licenseType: 'full',
        };
      }

      // Calculate trial days remaining
      const trialStartDate = new Date(binding.trial_start_date || binding.created_at);
      const trialDays = binding.trial_days || 30;
      const now = new Date();
      const diffTime = now.getTime() - trialStartDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, trialDays - diffDays);
      const isExpired = daysRemaining <= 0;

      return {
        isTrialActive: !isExpired,
        isTrialExpired: isExpired,
        isFullLicense: false,
        daysRemaining,
        licenseType: 'trial',
      };
    } catch (error) {
      console.error('Error getting trial status:', error);
      return {
        isTrialActive: false,
        isTrialExpired: true,
        isFullLicense: false,
        daysRemaining: 0,
        licenseType: 'none',
      };
    }
  }

  /**
   * Get days remaining in trial
   */
  async getTrialDaysRemaining(): Promise<number> {
    const status = await this.getTrialStatus();
    return status.daysRemaining;
  }

  /**
   * Check if trial is still active
   */
  async isTrialActive(): Promise<boolean> {
    const status = await this.getTrialStatus();
    return status.isTrialActive;
  }

  /**
   * Check if trial has expired
   */
  async isTrialExpired(): Promise<boolean> {
    const status = await this.getTrialStatus();
    return status.isTrialExpired;
  }

  /**
   * Check if device has a full license
   */
  async isFullLicense(): Promise<boolean> {
    const status = await this.getTrialStatus();
    return status.isFullLicense;
  }

  /**
   * Upgrade from trial to full license
   */
  async upgradeToPremium(licenseKey: string): Promise<ActivationResult> {
    if (Platform.OS === 'web') {
      return {
        success: true,
        message: 'Web platform - upgrade not required',
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

      const deviceId = await getDeviceFingerprint();
      const normalizedKey = licenseKey.replace(/[-\s]/g, '').toUpperCase();

      // Update existing trial to full license
      await this.db.runAsync(
        `UPDATE device_binding
         SET license_key = ?, license_type = 'full', activated_at = CURRENT_TIMESTAMP, last_verified_at = CURRENT_TIMESTAMP
         WHERE device_id = ?`,
        [normalizedKey, deviceId]
      );

      const updatedBinding = await this.getDeviceBinding(deviceId);

      return {
        success: true,
        message: 'Congratulations! Your app is now fully licensed.',
        deviceBinding: updatedBinding || undefined,
      };
    } catch (error) {
      console.error('Error upgrading to premium:', error);
      return {
        success: false,
        message: `Upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
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
