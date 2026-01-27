/**
 * Device Service
 * Generates a unique device identifier for device binding/licensing
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  brand: string;
  modelName: string;
  osName: string;
  osVersion: string;
  appVersion: string;
}

/**
 * Generate a unique device fingerprint by combining multiple device identifiers
 */
export const getDeviceFingerprint = async (): Promise<string> => {
  try {
    const components: string[] = [];

    // Get Android ID (unique per device per app signature)
    if (Platform.OS === 'android') {
      const androidId = await Application.getAndroidId();
      if (androidId) {
        components.push(androidId);
      }
    }

    // Get iOS identifier (unique per device per vendor)
    if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      if (iosId) {
        components.push(iosId);
      }
    }

    // Add device-specific information for additional uniqueness
    components.push(Device.brand || 'unknown_brand');
    components.push(Device.modelName || 'unknown_model');
    components.push(Device.deviceName || 'unknown_device');
    components.push(Platform.OS);
    components.push(Device.osVersion || 'unknown_os');

    // Combine all components and hash them
    const combined = components.join('|');
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );

    return hash;
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    throw new Error('Failed to generate device fingerprint');
  }
};

/**
 * Get detailed device information
 */
export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  const deviceId = await getDeviceFingerprint();

  return {
    deviceId,
    deviceName: Device.deviceName || 'Unknown Device',
    brand: Device.brand || 'Unknown Brand',
    modelName: Device.modelName || 'Unknown Model',
    osName: Platform.OS,
    osVersion: Device.osVersion || 'Unknown',
    appVersion: Application.nativeApplicationVersion || '1.0.0',
  };
};

/**
 * Generate a simple license key format for display
 * Format: XXXX-XXXX-XXXX-XXXX
 */
export const formatLicenseKey = (key: string): string => {
  const cleaned = key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const parts = cleaned.match(/.{1,4}/g) || [];
  return parts.slice(0, 4).join('-');
};

/**
 * Validate license key format
 */
export const isValidLicenseKeyFormat = (key: string): boolean => {
  const cleaned = key.replace(/[-\s]/g, '').toUpperCase();
  return /^[A-Z0-9]{16}$/.test(cleaned);
};

/**
 * Generate a license key from device ID (for seller use)
 * This creates a deterministic license key based on device fingerprint
 */
export const generateLicenseKeyFromDeviceId = async (deviceId: string, salt: string): Promise<string> => {
  const combined = `${deviceId}|${salt}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );

  // Take first 16 characters and format as license key
  const shortHash = hash.substring(0, 16).toUpperCase();
  return formatLicenseKey(shortHash);
};
