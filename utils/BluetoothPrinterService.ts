/**
 * Bluetooth Printer Service
 *
 * Manages Bluetooth Low Energy (BLE) connections to thermal printers.
 * Uses react-native-ble-plx for BLE communication.
 */

import { PermissionsAndroid, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ESCPOSBuilder, PRINTER_WIDTH, buildTestPrint } from './escpos';

// Conditionally import BLE - not available on web
let BleManager: any = null;
let Device: any = null;
let State: any = null;
let Characteristic: any = null;

if (Platform.OS !== 'web') {
  try {
    const bleModule = require('react-native-ble-plx');
    BleManager = bleModule.BleManager;
    Device = bleModule.Device;
    State = bleModule.State;
    Characteristic = bleModule.Characteristic;
  } catch (e) {
    console.log('BLE module not available');
  }
}

// Common Bluetooth printer service UUIDs
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART Service
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common Chinese printer
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Some printer models
];

// Common characteristic UUIDs for writing
const PRINTER_CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // Generic write
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // Nordic UART TX
  '0000ff02-0000-1000-8000-00805f9b34fb', // Common Chinese printer write
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // Some printer models
];

// Storage keys
const STORAGE_KEYS = {
  LAST_PRINTER: '@printer_last_device',
  PRINTER_WIDTH: '@printer_width',
  AUTO_CONNECT: '@printer_auto_connect',
  AUTO_CUT: '@printer_auto_cut',
};

export interface PrinterDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  isConnectable: boolean | null;
}

export interface PrinterSettings {
  printerWidth: number;
  autoConnect: boolean;
  autoCut: boolean;
  lastPrinterId: string | null;
  lastPrinterName: string | null;
}

export type PrinterState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

type PrinterStateListener = (state: PrinterState, message?: string) => void;
type DeviceFoundListener = (device: PrinterDevice) => void;

class BluetoothPrinterService {
  private static instance: BluetoothPrinterService;
  private bleManager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private writeCharacteristic: Characteristic | null = null;
  private currentState: PrinterState = 'disconnected';
  private stateListeners: PrinterStateListener[] = [];
  private deviceFoundListeners: DeviceFoundListener[] = [];
  private discoveredDevices: Map<string, PrinterDevice> = new Map();
  private settings: PrinterSettings = {
    printerWidth: PRINTER_WIDTH.MM_58,
    autoConnect: false,
    autoCut: true,
    lastPrinterId: null,
    lastPrinterName: null,
  };

  private constructor() {
    // Initialize BLE manager
    this.initializeBleManager();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BluetoothPrinterService {
    if (!BluetoothPrinterService.instance) {
      BluetoothPrinterService.instance = new BluetoothPrinterService();
    }
    return BluetoothPrinterService.instance;
  }

  /**
   * Initialize BLE manager
   */
  private async initializeBleManager(): Promise<void> {
    // Skip BLE initialization on web or if module not available
    if (Platform.OS === 'web' || !BleManager) {
      console.log('BLE not available on this platform');
      await this.loadSettings();
      return;
    }

    try {
      this.bleManager = new BleManager();

      // Monitor Bluetooth state changes
      this.bleManager.onStateChange((state: any) => {
        console.log('Bluetooth state changed:', state);
        if (State && state === State.PoweredOff) {
          this.setState('disconnected', 'Bluetooth is turned off');
        }
      }, true);

      // Load saved settings
      await this.loadSettings();
    } catch (error) {
      console.log('BLE initialization skipped:', (error as Error).message);
      await this.loadSettings();
    }
  }

  /**
   * Load saved settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const [lastPrinter, width, autoConnect, autoCut] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.LAST_PRINTER),
        AsyncStorage.getItem(STORAGE_KEYS.PRINTER_WIDTH),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_CONNECT),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_CUT),
      ]);

      if (lastPrinter) {
        const printer = JSON.parse(lastPrinter);
        this.settings.lastPrinterId = printer.id;
        this.settings.lastPrinterName = printer.name;
      }

      if (width) {
        this.settings.printerWidth = parseInt(width, 10);
      }

      if (autoConnect) {
        this.settings.autoConnect = autoConnect === 'true';
      }

      if (autoCut) {
        this.settings.autoCut = autoCut !== 'false'; // Default true
      }
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(
          STORAGE_KEYS.LAST_PRINTER,
          JSON.stringify({
            id: this.settings.lastPrinterId,
            name: this.settings.lastPrinterName,
          })
        ),
        AsyncStorage.setItem(STORAGE_KEYS.PRINTER_WIDTH, this.settings.printerWidth.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.AUTO_CONNECT, this.settings.autoConnect.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.AUTO_CUT, this.settings.autoCut.toString()),
      ]);
    } catch (error) {
      console.error('Failed to save printer settings:', error);
    }
  }

  /**
   * Set printer state and notify listeners
   */
  private setState(state: PrinterState, message?: string): void {
    this.currentState = state;
    this.stateListeners.forEach((listener) => listener(state, message));
  }

  /**
   * Get current printer state
   */
  getState(): PrinterState {
    return this.currentState;
  }

  /**
   * Get current settings
   */
  getSettings(): PrinterSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(settings: Partial<PrinterSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.saveSettings();
  }

  /**
   * Add state change listener
   */
  addStateListener(listener: PrinterStateListener): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Add device found listener
   */
  addDeviceFoundListener(listener: DeviceFoundListener): () => void {
    this.deviceFoundListeners.push(listener);
    return () => {
      this.deviceFoundListeners = this.deviceFoundListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Request Bluetooth permissions (Android)
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const apiLevel = Platform.Version;

      if (apiLevel >= 31) {
        // Android 12+ permissions
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(results).every(
          (result) => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permissions Required',
            'Bluetooth and location permissions are required to connect to printers.'
          );
          return false;
        }
      } else {
        // Android 11 and below
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (locationPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Required',
            'Location permission is required to scan for Bluetooth devices.'
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  /**
   * Check if Bluetooth is enabled
   */
  async isBluetoothEnabled(): Promise<boolean> {
    if (!this.bleManager || !State) return false;

    try {
      const state = await this.bleManager.state();
      return state === State.PoweredOn;
    } catch (error) {
      console.error('Failed to check Bluetooth state:', error);
      return false;
    }
  }

  /**
   * Check if BLE is available on this platform
   */
  isBleAvailable(): boolean {
    return Platform.OS !== 'web' && BleManager !== null;
  }

  /**
   * Start scanning for printers
   */
  async startScan(durationMs: number = 10000): Promise<PrinterDevice[]> {
    if (!this.isBleAvailable()) {
      throw new Error('Bluetooth is not available on this platform');
    }

    if (!this.bleManager) {
      throw new Error('BLE Manager not initialized');
    }

    // Request permissions first
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Bluetooth permissions not granted');
    }

    // Check Bluetooth state
    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      throw new Error('Bluetooth is not enabled');
    }

    this.discoveredDevices.clear();
    this.setState('scanning');

    return new Promise((resolve, reject) => {
      let scanTimeout: NodeJS.Timeout;

      try {
        this.bleManager!.startDeviceScan(
          null, // Scan for all devices, filter later
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              console.error('Scan error:', error);
              this.setState('error', error.message);
              reject(error);
              return;
            }

            if (device && device.name) {
              // Filter for likely printer devices
              const isPrinter = this.isPrinterDevice(device);

              if (isPrinter) {
                const printerDevice: PrinterDevice = {
                  id: device.id,
                  name: device.name,
                  rssi: device.rssi,
                  isConnectable: device.isConnectable,
                };

                this.discoveredDevices.set(device.id, printerDevice);
                this.deviceFoundListeners.forEach((listener) => listener(printerDevice));
              }
            }
          }
        );

        // Stop scanning after duration
        scanTimeout = setTimeout(() => {
          this.stopScan();
          this.setState('disconnected');
          resolve(Array.from(this.discoveredDevices.values()));
        }, durationMs);
      } catch (error) {
        clearTimeout(scanTimeout!);
        this.setState('error', (error as Error).message);
        reject(error);
      }
    });
  }

  /**
   * Check if device is likely a printer
   */
  private isPrinterDevice(device: Device): boolean {
    const name = device.name?.toLowerCase() || '';

    // Common printer name patterns
    const printerPatterns = [
      'printer',
      'pos',
      'thermal',
      'receipt',
      'bluetooth printer',
      'mpt',
      'xprinter',
      'goojprt',
      'milestone',
      'zjiang',
      'rongta',
      'tpms',
      'hm-',
      'bt-',
      'inner',
      'star',
      'epson',
      'bixolon',
      'citizen',
      'sewoo',
    ];

    return printerPatterns.some((pattern) => name.includes(pattern));
  }

  /**
   * Stop scanning
   */
  stopScan(): void {
    if (this.bleManager) {
      this.bleManager.stopDeviceScan();
    }
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): PrinterDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Connect to a printer device
   */
  async connect(deviceId: string): Promise<boolean> {
    if (!this.isBleAvailable()) {
      throw new Error('Bluetooth is not available on this platform');
    }

    if (!this.bleManager) {
      throw new Error('BLE Manager not initialized');
    }

    this.stopScan();
    this.setState('connecting');

    try {
      // Connect to device
      console.log('Connecting to device:', deviceId);
      const device = await this.bleManager.connectToDevice(deviceId, {
        timeout: 10000,
      });

      // Discover services and characteristics
      console.log('Discovering services...');
      await device.discoverAllServicesAndCharacteristics();

      // Find write characteristic
      const characteristic = await this.findWriteCharacteristic(device);

      if (!characteristic) {
        await device.cancelConnection();
        throw new Error('Could not find printer write characteristic');
      }

      this.connectedDevice = device;
      this.writeCharacteristic = characteristic;

      // Save as last connected printer
      this.settings.lastPrinterId = device.id;
      this.settings.lastPrinterName = device.name;
      await this.saveSettings();

      // Monitor disconnection
      device.onDisconnected((error, disconnectedDevice) => {
        console.log('Device disconnected:', disconnectedDevice?.id, error?.message);
        this.connectedDevice = null;
        this.writeCharacteristic = null;
        this.setState('disconnected', 'Printer disconnected');
      });

      this.setState('connected');
      console.log('Connected successfully to:', device.name);
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      this.setState('error', (error as Error).message);
      throw error;
    }
  }

  /**
   * Find writable characteristic for printer
   */
  private async findWriteCharacteristic(device: Device): Promise<Characteristic | null> {
    try {
      const services = await device.services();

      for (const service of services) {
        const characteristics = await service.characteristics();

        for (const characteristic of characteristics) {
          // Check if characteristic is writable
          if (characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse) {
            // Check against known printer characteristic UUIDs
            const uuid = characteristic.uuid.toLowerCase();
            const isKnownPrinter = PRINTER_CHARACTERISTIC_UUIDS.some(
              (knownUuid) => uuid.includes(knownUuid.toLowerCase())
            );

            if (isKnownPrinter) {
              return characteristic;
            }
          }
        }
      }

      // If no known characteristic found, return first writable one
      for (const service of services) {
        const characteristics = await service.characteristics();

        for (const characteristic of characteristics) {
          if (characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse) {
            return characteristic;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding write characteristic:', error);
      return null;
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch (error) {
        console.error('Disconnect error:', error);
      }
      this.connectedDevice = null;
      this.writeCharacteristic = null;
    }
    this.setState('disconnected');
  }

  /**
   * Check if connected to a printer
   */
  isConnected(): boolean {
    return this.currentState === 'connected' && this.connectedDevice !== null;
  }

  /**
   * Get connected device info
   */
  getConnectedDevice(): PrinterDevice | null {
    if (!this.connectedDevice) return null;

    return {
      id: this.connectedDevice.id,
      name: this.connectedDevice.name,
      rssi: this.connectedDevice.rssi,
      isConnectable: true,
    };
  }

  /**
   * Print raw bytes to printer
   */
  async printRaw(data: Uint8Array): Promise<boolean> {
    if (!this.isConnected() || !this.writeCharacteristic) {
      throw new Error('Not connected to printer');
    }

    try {
      // Convert to base64
      const base64Data = this.uint8ArrayToBase64(data);

      // BLE has MTU limits, so we may need to chunk the data
      const chunkSize = 20; // Conservative BLE MTU
      const chunks: string[] = [];

      for (let i = 0; i < base64Data.length; i += chunkSize) {
        chunks.push(base64Data.slice(i, i + chunkSize));
      }

      // Send each chunk
      for (const chunk of chunks) {
        if (this.writeCharacteristic.isWritableWithResponse) {
          await this.writeCharacteristic.writeWithResponse(chunk);
        } else {
          await this.writeCharacteristic.writeWithoutResponse(chunk);
        }

        // Small delay between chunks
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      return true;
    } catch (error) {
      console.error('Print error:', error);
      throw error;
    }
  }

  /**
   * Print using ESCPOSBuilder
   */
  async print(builder: ESCPOSBuilder): Promise<boolean> {
    const data = builder.build();
    return this.printRaw(data);
  }

  /**
   * Print test page
   */
  async printTestPage(): Promise<boolean> {
    const builder = buildTestPrint(this.settings.printerWidth);
    return this.print(builder);
  }

  /**
   * Auto-connect to last printer
   */
  async autoConnect(): Promise<boolean> {
    if (!this.settings.autoConnect || !this.settings.lastPrinterId) {
      return false;
    }

    try {
      return await this.connect(this.settings.lastPrinterId);
    } catch (error) {
      console.log('Auto-connect failed:', error);
      return false;
    }
  }

  /**
   * Helper: Convert Uint8Array to base64
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Destroy the service (cleanup)
   */
  destroy(): void {
    this.disconnect();
    if (this.bleManager) {
      this.bleManager.destroy();
      this.bleManager = null;
    }
    this.stateListeners = [];
    this.deviceFoundListeners = [];
  }
}

export default BluetoothPrinterService;
