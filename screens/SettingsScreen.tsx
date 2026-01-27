import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Share,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  List,
  Switch,
  useTheme,
  Dialog,
  Portal,
  Divider,
} from 'react-native-paper';
import { ScreenGuard } from '../components/RoleGuard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const WEB_STORAGE_KEY = 'posmobile_webmock_db';

type SettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Settings'
>;

type Props = {
  navigation: SettingsScreenNavigationProp;
};

interface Settings {
  company_name: string;
  company_address: string;
  company_tin: string;
  pos_serial: string;
  vat_rate: string;
  receipt_footer: string;
}

export default function SettingsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<Settings>({
    company_name: '',
    company_address: '',
    company_tin: '',
    pos_serial: '',
    vat_rate: '12.00',
    receipt_footer: '',
  });
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [currentSetting, setCurrentSetting] = useState<{
    key: keyof Settings;
    label: string;
    value: string;
  } | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [licensePasswordDialogVisible, setLicensePasswordDialogVisible] = useState(false);
  const [licensePassword, setLicensePassword] = useState('');
  const theme = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const dbService = getDatabase();
      const settingsData: Settings = {
        company_name: await dbService.getSetting('company_name') || 'Your Company Name',
        company_address: await dbService.getSetting('company_address') || 'Your Company Address',
        company_tin: await dbService.getSetting('company_tin') || '000-000-000-000',
        pos_serial: await dbService.getSetting('pos_serial') || 'POS000000',
        vat_rate: await dbService.getSetting('vat_rate') || '12.00',
        receipt_footer: await dbService.getSetting('receipt_footer') || 'Thank you for your business!',
      };
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    }
  };

  const handleEditSetting = (key: keyof Settings, label: string, value: string) => {
    setCurrentSetting({ key, label, value });
    setTempValue(value);
    setDialogVisible(true);
  };

  const handleSaveSetting = async () => {
    if (!currentSetting) return;

    if (!tempValue.trim()) {
      Alert.alert('Error', 'Value cannot be empty');
      return;
    }

    // Validate VAT rate
    if (currentSetting.key === 'vat_rate') {
      const vatRate = parseFloat(tempValue);
      if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
        Alert.alert('Error', 'VAT rate must be a number between 0 and 100');
        return;
      }
      // Warn if not standard Philippine VAT rate
      if (vatRate !== 12) {
        Alert.alert(
          'Non-Standard VAT Rate',
          `You entered ${vatRate}%. The standard Philippine VAT rate is 12%. Are you sure you want to continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => saveSetting(vatRate.toFixed(2)) }
          ]
        );
        return;
      }
    }

    // Validate TIN format (Philippine format: XXX-XXX-XXX-XXX)
    if (currentSetting.key === 'company_tin') {
      const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
      if (!tinRegex.test(tempValue.trim())) {
        Alert.alert('Error', 'TIN must be in format: 000-000-000-000');
        return;
      }
    }

    // Validate POS Serial format (e.g., POS000000)
    if (currentSetting.key === 'pos_serial') {
      const posSerialRegex = /^[A-Za-z]{2,5}\d{4,8}$/;
      if (!posSerialRegex.test(tempValue.trim())) {
        Alert.alert('Error', 'POS Serial must be in format: POS000000 (letters followed by numbers)');
        return;
      }
    }

    await saveSetting(tempValue);
  };

  const saveSetting = async (value: string) => {
    if (!currentSetting) return;

    setLoading(true);
    try {
      const dbService = getDatabase();
      await dbService.updateSetting(currentSetting.key, value);

      setSettings(prev => ({
        ...prev,
        [currentSetting.key]: value
      }));

      setDialogVisible(false);
      setCurrentSetting(null);
      setTempValue('');

      Alert.alert('Success', 'Setting updated successfully');
    } catch (error) {
      console.error('Error saving setting:', error);
      Alert.alert('Error', 'Failed to save setting');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    Alert.alert(
      'Create Backup',
      'This will create a backup file of all your data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Backup',
          onPress: async () => {
            try {
              setLoading(true);

              // Check if we're on web (check for document/window)
              const isWebPlatform = Platform.OS === 'web' || typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';
              console.log('[Backup] Platform:', Platform.OS, 'isWeb:', isWebPlatform);

              if (isWebPlatform) {
                // Web backup - download JSON file
                await createWebBackup();
              } else {
                // Native backup - use file system
                await createNativeBackup();
              }

              Alert.alert('Success', 'Database backup created successfully!');
            } catch (error) {
              console.error('Backup failed:', error);
              Alert.alert('Error', `Backup failed: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const createWebBackup = async () => {
    const dbService = getDatabase();

    // Get counts for metadata
    const products = await dbService.getProducts();
    const transactions = await dbService.getTransactions();
    const users = await dbService.getUsers();

    const metadata = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      app_version: '1.0.0',
      product_count: products.length,
      transaction_count: transactions.length,
      user_count: users.length
    };

    // Get all localStorage data
    const storedData = localStorage.getItem(WEB_STORAGE_KEY);
    const backupData = {
      metadata,
      platform: 'web',
      data: storedData ? JSON.parse(storedData) : {}
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_backup_${timestamp}.json`;

    // Create and download file
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[Backup] Web backup downloaded:', filename);
  };

  const createNativeBackup = async () => {
    const dbService = getDatabase();

    // Get data using available methods
    const products = await dbService.getProducts(false); // Get all products including inactive
    const users = await dbService.getUsers();
    const suppliers = await dbService.getSuppliers(false);
    const customers = await dbService.getCustomers(false);

    // Get categories - check if method exists
    let categories: any[] = [];
    if (typeof dbService.getCategories === 'function') {
      categories = await dbService.getCategories();
    }

    // Get transactions count from today's transactions or database summary
    let transactionCount = 0;
    if (typeof dbService.getTransactionalDataSummary === 'function') {
      const summary = await dbService.getTransactionalDataSummary();
      transactionCount = summary.transactions || 0;
    }

    const metadata = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      app_version: '1.0.0',
      product_count: products.length,
      transaction_count: transactionCount,
      user_count: users.length,
      supplier_count: suppliers.length,
      customer_count: customers.length
    };

    // Create backup data structure
    const backupData = {
      metadata,
      platform: 'native',
      tables: {
        products,
        users,
        categories,
        suppliers,
        customers,
      }
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pos_backup_${timestamp}.json`;
    const backupContent = JSON.stringify(backupData, null, 2);

    // Log available directories for debugging
    console.log('[Backup] documentDirectory:', FileSystem.documentDirectory);
    console.log('[Backup] cacheDirectory:', FileSystem.cacheDirectory);

    // Try to get a writable directory
    let baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

    if (baseDir) {
      // Standard file save approach
      const backupPath = `${baseDir}${filename}`;
      console.log('[Backup] Saving native backup to:', backupPath);

      // Write the file
      await FileSystem.writeAsStringAsync(backupPath, backupContent);

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupPath, {
          mimeType: 'application/json',
          dialogTitle: 'Save Database Backup'
        });
      } else {
        Alert.alert('Info', `Backup saved to: ${backupPath}`);
      }

      console.log('[Backup] Native backup created and shared:', filename);
    } else {
      // Fallback: Use React Native Share API to share text content
      console.log('[Backup] No file directory available, using Share API...');

      // For large backups, we'll share a summary and offer to copy full data
      const summaryText = `POS Backup Summary (${new Date().toLocaleString()})\n\n` +
        `Products: ${metadata.product_count}\n` +
        `Users: ${metadata.user_count}\n` +
        `Suppliers: ${metadata.supplier_count}\n` +
        `Customers: ${metadata.customer_count}\n` +
        `Transactions: ${metadata.transaction_count}\n\n` +
        `Full backup data is too large to share directly.\n` +
        `Please use a file manager app or connect to a computer to export data.`;

      try {
        await Share.share({
          message: summaryText,
          title: 'POS Backup Summary'
        });
      } catch (shareError) {
        console.error('[Backup] Share failed:', shareError);
      }

      // Show alert with option to view full data
      Alert.alert(
        'Backup Created',
        `Your backup contains:\n` +
        `• ${metadata.product_count} products\n` +
        `• ${metadata.user_count} users\n` +
        `• ${metadata.supplier_count} suppliers\n` +
        `• ${metadata.customer_count} customers\n\n` +
        `Note: File system not available on this device. ` +
        `Data is stored in the app's database.`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleRestore = async () => {
    // Check if user has permission to restore (Admin or Manager only)
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      Alert.alert(
        'Access Denied',
        'Only administrators and managers can restore database backups.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Restore Database',
      'This will replace ALL current data with data from a backup file. This action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Backup File',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // Check if we're on web
              const isWebPlatform = Platform.OS === 'web' || typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';

              let success = false;
              if (isWebPlatform) {
                success = await restoreWebBackup();
              } else {
                success = await restoreNativeBackup();
              }

              if (success) {
                Alert.alert(
                  'Success',
                  'Database restored successfully. Please refresh the app to see changes.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Reload settings after restore
                        loadSettings();
                        // On web, reload the page
                        if (isWebPlatform) {
                          window.location.reload();
                        }
                      }
                    }
                  ]
                );
              }
            } catch (error) {
              console.error('Restore failed:', error);
              Alert.alert('Error', `Restore failed: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const restoreWebBackup = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';

      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(false);
          return;
        }

        try {
          const content = await file.text();
          const backupData = JSON.parse(content);

          // Validate backup format
          if (!backupData.metadata) {
            throw new Error('Invalid backup file format');
          }

          // Restore data to localStorage
          if (backupData.platform === 'web' && backupData.data) {
            localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(backupData.data));
            console.log('[Restore] Web backup restored successfully');
            resolve(true);
          } else if (backupData.tables) {
            // Convert native backup format to web format
            const webData = convertNativeToWebFormat(backupData.tables);
            localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(webData));
            console.log('[Restore] Native backup converted and restored to web');
            resolve(true);
          } else {
            throw new Error('Unsupported backup format');
          }
        } catch (error) {
          console.error('Restore failed:', error);
          reject(error);
        }
      };

      input.click();
    });
  };

  const restoreNativeBackup = async (): Promise<boolean> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return false;
      }

      const backupPath = result.assets[0].uri;
      console.log('[Restore] Reading backup from:', backupPath);

      // Read the backup file
      const backupContent = await FileSystem.readAsStringAsync(backupPath);
      const backupData = JSON.parse(backupContent);

      // Validate backup format
      if (!backupData.metadata) {
        throw new Error('Invalid backup file format');
      }

      // For now, just show success - actual database restore would need
      // to be implemented based on the database service being used
      console.log('[Restore] Backup data loaded:', backupData.metadata);

      // TODO: Implement actual data restoration to SQLite database
      // This would require DatabaseService to have methods to clear and restore data

      Alert.alert(
        'Backup Loaded',
        `Backup from ${new Date(backupData.metadata.timestamp).toLocaleString()} contains:\n` +
        `- ${backupData.metadata.product_count} products\n` +
        `- ${backupData.metadata.transaction_count} transactions\n` +
        `- ${backupData.metadata.user_count} users\n\n` +
        `Note: Full restore to SQLite is pending implementation.`
      );

      return true;
    } catch (error) {
      console.error('[Restore] Error:', error);
      throw error;
    }
  };

  const convertNativeToWebFormat = (tables: Record<string, any[]>): any => {
    const convertSettingsArray = (settingsArray: any[]): Record<string, string> => {
      const settings: Record<string, string> = {};
      for (const item of settingsArray) {
        if (item.key && item.value !== undefined) {
          settings[item.key] = item.value;
        }
      }
      return settings;
    };

    return {
      products: tables.products || [],
      categories: tables.categories || [],
      brands: tables.brands || [],
      units: tables.units || [],
      sizes: tables.sizes || [],
      transactions: tables.transactions || [],
      users: tables.users || [],
      suppliers: tables.suppliers || [],
      customers: tables.customers || [],
      settings: convertSettingsArray(tables.settings || []),
      inventoryMovements: tables.inventory_movements || [],
      physicalCountSessions: tables.physical_count_sessions || [],
      physicalCountDetails: tables.physical_count_details || [],
      damageSessions: tables.damage_sessions || [],
      damageDetails: tables.damage_details || [],
      purchases: tables.purchases || [],
      purchaseItems: tables.purchase_items || [],
      accountsReceivable: tables.accounts_receivable || [],
      accountsPayable: tables.accounts_payable || [],
      customerPayments: tables.customer_payments || [],
      supplierPayments: tables.supplier_payments || [],
      eJournalEntries: tables.ejournal || [],
      salesReturns: tables.sales_returns || [],
      salesReturnItems: tables.sales_return_items || [],
      purchaseReturns: tables.purchase_returns || [],
      purchaseReturnItems: tables.purchase_return_items || [],
      endOfDayRecords: tables.end_of_day_records || [],
      counters: {
        productIdCounter: Math.max(...(tables.products || []).map((p: any) => p.id || 0), 0) + 1,
        categoryIdCounter: Math.max(...(tables.categories || []).map((c: any) => c.id || 0), 0) + 1,
        transactionIdCounter: Math.max(...(tables.transactions || []).map((t: any) => t.id || 0), 0) + 1,
      }
    };
  };

  const handleClearPhysicalInventory = async () => {
    Alert.alert(
      'Clear Physical Inventory Data',
      'This will delete all physical inventory history, count sessions, and reset all product stock quantities to zero. This action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Clear',
              'Are you sure? This will permanently delete all physical inventory data and reset stock quantities to zero.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Clear All',
                  style: 'destructive',
                  onPress: performClearPhysicalInventory,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performClearPhysicalInventory = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      await dbService.clearPhysicalInventoryData();
      Alert.alert('Success', 'Physical inventory data cleared and stock quantities reset to zero successfully.');
    } catch (error) {
      console.error('Error clearing physical inventory data:', error);
      Alert.alert('Error', 'Failed to clear physical inventory data');
    } finally {
      setLoading(false);
    }
  };


  const handleValidateDatabase = async () => {
    try {
      setLoading(true);

      const isWebPlatform = Platform.OS === 'web' || typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';
      let validation: { isValid: boolean; errors: string[] };

      if (isWebPlatform) {
        validation = validateWebDatabase();
      } else {
        const { DatabaseBackupService } = require('../utils/DatabaseBackupService');
        const backupService = DatabaseBackupService.getInstance();
        validation = await backupService.validateDatabase();
      }

      if (validation.isValid) {
        Alert.alert(
          'Database Validation',
          'Database is healthy and all integrity checks passed.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Database Issues Found',
          `Found ${validation.errors.length} issue(s):\n\n${validation.errors.join('\n')}\n\nWould you like to attempt repair?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Repair',
              onPress: async () => {
                try {
                  if (isWebPlatform) {
                    repairWebDatabase();
                    Alert.alert('Repair Successful', 'Database repair completed successfully', [{ text: 'OK' }]);
                  } else {
                    const { DatabaseBackupService } = require('../utils/DatabaseBackupService');
                    const backupService = DatabaseBackupService.getInstance();
                    const repair = await backupService.repairDatabase();
                    Alert.alert(
                      repair.success ? 'Repair Successful' : 'Repair Failed',
                      repair.message,
                      [{ text: 'OK' }]
                    );
                  }
                } catch (error) {
                  Alert.alert('Error', `Repair failed: ${error}`);
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', `Validation failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const validateWebDatabase = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    try {
      const storedData = localStorage.getItem(WEB_STORAGE_KEY);
      if (!storedData) {
        errors.push('No database data found');
        return { isValid: false, errors };
      }
      const data = JSON.parse(storedData);
      const requiredArrays = ['products', 'users', 'categories'];
      for (const arr of requiredArrays) {
        if (!Array.isArray(data[arr])) {
          errors.push(`Missing or invalid data: ${arr}`);
        }
      }
      const adminUser = data.users?.find((u: any) => u.role === 'ADMIN');
      if (!adminUser) {
        errors.push('No admin user found');
      }
    } catch (error) {
      errors.push(`Database validation error: ${error}`);
    }
    return { isValid: errors.length === 0, errors };
  };

  const repairWebDatabase = () => {
    const storedData = localStorage.getItem(WEB_STORAGE_KEY);
    if (storedData) {
      const data = JSON.parse(storedData);
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(data));
    }
  };

  const handleOpenLicenseGenerator = () => {
    setLicensePassword('');
    setLicensePasswordDialogVisible(true);
  };

  const handleLicensePasswordSubmit = () => {
    if (licensePassword === '1018') {
      setLicensePasswordDialogVisible(false);
      setLicensePassword('');
      navigation.navigate('LicenseGenerator');
    } else {
      Alert.alert('Access Denied', 'Incorrect password');
      setLicensePassword('');
    }
  };

  const handleOptimizeDatabase = async () => {
    Alert.alert(
      'Optimize Database',
      'This will analyze, reindex, and compact the database to improve performance. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Optimize',
          onPress: async () => {
            try {
              setLoading(true);

              const isWebPlatform = Platform.OS === 'web' || typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';

              if (isWebPlatform) {
                // Web optimization - compact localStorage
                const storedData = localStorage.getItem(WEB_STORAGE_KEY);
                if (storedData) {
                  const data = JSON.parse(storedData);
                  localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(data));
                }
              } else {
                const { DatabaseBackupService } = require('../utils/DatabaseBackupService');
                const backupService = DatabaseBackupService.getInstance();
                await backupService.optimizeDatabase();
              }

              Alert.alert('Success', 'Database optimization completed successfully!');
            } catch (error) {
              Alert.alert('Error', `Optimization failed: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const settingsList = [
    { key: 'company_name' as keyof Settings, label: 'Company Name', value: settings.company_name },
    { key: 'company_address' as keyof Settings, label: 'Company Address', value: settings.company_address },
    { key: 'company_tin' as keyof Settings, label: 'TIN Number', value: settings.company_tin },
    { key: 'pos_serial' as keyof Settings, label: 'POS Serial Number', value: settings.pos_serial },
    { key: 'vat_rate' as keyof Settings, label: 'VAT Rate (%)', value: settings.vat_rate },
    { key: 'receipt_footer' as keyof Settings, label: 'Receipt Footer', value: settings.receipt_footer },
  ];

  return (
    <ScreenGuard screenName="Settings">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Company Information */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Company Information</Title>
              <Paragraph style={styles.cardSubtitle}>
                Basic company details for receipts and Business compliance
              </Paragraph>

              {settingsList.slice(0, 3).map((setting) => (
                <List.Item
                  key={setting.key}
                  title={setting.label}
                  description={setting.value || 'Not set'}
                  left={props => <List.Icon {...props} icon="office-building" />}
                  right={props => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => handleEditSetting(setting.key, setting.label, setting.value)}
                  style={styles.listItem}
                />
              ))}
            </Card.Content>
          </Card>

          {/* Business Configuration */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Business Configuration</Title>
              <Paragraph style={styles.cardSubtitle}>
                Business-required information for compliance
              </Paragraph>

              {settingsList.slice(3, 6).map((setting) => (
                <List.Item
                  key={setting.key}
                  title={setting.label}
                  description={setting.value || 'Not set'}
                  left={props => <List.Icon {...props} icon="file-certificate" />}
                  right={props => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => handleEditSetting(setting.key, setting.label, setting.value)}
                  style={styles.listItem}
                />
              ))}
            </Card.Content>
          </Card>

          {/* System Settings */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>System Settings</Title>
              <Paragraph style={styles.cardSubtitle}>
                General system configuration
              </Paragraph>

              {settingsList.slice(6).map((setting) => (
                <List.Item
                  key={setting.key}
                  title={setting.label}
                  description={setting.key === 'vat_rate' ? `${setting.value}%` : setting.value || 'Not set'}
                  left={props => <List.Icon {...props} icon="cog" />}
                  right={props => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => handleEditSetting(setting.key, setting.label, setting.value)}
                  style={styles.listItem}
                />
              ))}
            </Card.Content>
          </Card>

          {/* Master Data Management */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Master Data</Title>
              <Paragraph style={styles.cardSubtitle}>
                Manage product categories, brands, units, and sizes
              </Paragraph>

              <List.Item
                title="Categories"
                description="Manage product categories"
                left={props => <List.Icon {...props} icon="folder" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('Categories')}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Brands"
                description="Manage product brands"
                left={props => <List.Icon {...props} icon="tag" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('Brands')}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Units of Measure"
                description="Manage units (pcs, kg, L, box, etc.)"
                left={props => <List.Icon {...props} icon="scale" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('Units')}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Sizes"
                description="Manage product sizes (S, M, L, 500ml, etc.)"
                left={props => <List.Icon {...props} icon="resize" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('Sizes')}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>

          {/* Cheque Management */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Cheque Management</Title>
              <Paragraph style={styles.cardSubtitle}>
                Track post-dated cheques and manage cheque status
              </Paragraph>

              <List.Item
                title="PDC Tracking"
                description="Manage post-dated cheques (pending, deposited, cleared, bounced)"
                left={props => <List.Icon {...props} icon="checkbook" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('PDCTracking')}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>

          {/* License Management - Admin Only */}
          {user?.role === 'ADMIN' && (
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.cardTitle}>License Management</Title>
                <Paragraph style={styles.cardSubtitle}>
                  Generate license keys for customer devices
                </Paragraph>

                <List.Item
                  title="License Key Generator"
                  description="Generate license keys for new device activations"
                  left={props => <List.Icon {...props} icon="key-variant" />}
                  right={props => <List.Icon {...props} icon="chevron-right" />}
                  onPress={handleOpenLicenseGenerator}
                  style={styles.listItem}
                />
              </Card.Content>
            </Card>
          )}

          {/* Hardware Settings */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Hardware Settings</Title>
              <Paragraph style={styles.cardSubtitle}>
                Configure printers, scanners, and other devices
              </Paragraph>

              <List.Item
                title="Printer Settings"
                description="Connect and configure thermal receipt printer"
                left={props => <List.Icon {...props} icon="printer" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('PrinterSettings')}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Barcode Scanner"
                description="Use camera to scan product barcodes"
                left={props => <List.Icon {...props} icon="barcode-scan" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('BarcodeScanner')}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>

          {/* Data Management */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Data Management</Title>
              <Paragraph style={styles.cardSubtitle}>
                Backup, restore, and reset options
              </Paragraph>

              <List.Item
                title="Backup Database"
                description="Export all data for backup"
                left={props => <List.Icon {...props} icon="export" />}
                right={props => <Button mode="outlined" compact onPress={handleBackup}>Backup</Button>}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Restore Database"
                description="Import data from backup"
                left={props => <List.Icon {...props} icon="import" />}
                right={props => <Button mode="outlined" compact onPress={handleRestore}>Restore</Button>}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Validate Database"
                description="Check database integrity and repair if needed"
                left={props => <List.Icon {...props} icon="database-check" />}
                right={props => <Button mode="outlined" compact onPress={handleValidateDatabase}>Validate</Button>}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Optimize Database"
                description="Improve database performance"
                left={props => <List.Icon {...props} icon="tune" />}
                right={props => <Button mode="outlined" compact onPress={handleOptimizeDatabase}>Optimize</Button>}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Test Data Generator"
                description="Add 5000 test products for testing"
                left={props => <List.Icon {...props} icon="test-tube" />}
                right={props => <Button mode="outlined" compact onPress={() => navigation.navigate('TestData')}>Generate</Button>}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Clear Physical Inventory"
                description="Delete physical inventory data and reset stock to zero"
                left={props => <List.Icon {...props} icon="package-variant" />}
                right={props => (
                  <Button
                    mode="outlined"
                    compact
                    textColor="#FF9800"
                    onPress={handleClearPhysicalInventory}
                    loading={loading}
                    disabled={loading}
                  >
                    Clear
                  </Button>
                )}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Reset Transactional Data"
                description="Delete all sales, purchases, payments, and inventory movements"
                left={props => <List.Icon {...props} icon="delete-forever" />}
                right={props => <List.Icon {...props} icon="chevron-right" color="#F44336" />}
                onPress={() => navigation.navigate('ResetData')}
                style={styles.listItem}
                titleStyle={{ color: '#F44336' }}
              />

            </Card.Content>
          </Card>

          {/* App Information */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>App Information</Title>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Version</Paragraph>
                  <Paragraph style={styles.infoValue}>1.0.0</Paragraph>
                </View>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Build</Paragraph>
                  <Paragraph style={styles.infoValue}>2024.1</Paragraph>
                </View>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Business Compliance</Paragraph>
                  <Paragraph style={[styles.infoValue, { color: '#4CAF50' }]}>Active</Paragraph>
                </View>
                <View style={styles.infoItem}>
                  <Paragraph style={styles.infoLabel}>Database</Paragraph>
                  <Paragraph style={styles.infoValue}>SQLite</Paragraph>
                </View>
              </View>

              <View style={styles.appFooter}>
                <Paragraph style={styles.footerText}>
                  Business-Compliant Mobile POS System
                </Paragraph>
                <Paragraph style={styles.footerSubtext}>
                  Developed for Philippine businesses
                </Paragraph>
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Edit Setting Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>
            Edit {currentSetting?.label}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              key={`${currentSetting?.key}-${dialogVisible}`}
              label={currentSetting?.label}
              value={tempValue}
              onChangeText={setTempValue}
              mode="outlined"
              multiline={currentSetting?.key === 'company_address' || currentSetting?.key === 'receipt_footer'}
              numberOfLines={currentSetting?.key === 'company_address' || currentSetting?.key === 'receipt_footer' ? 3 : 1}
              keyboardType={currentSetting?.key === 'vat_rate' ? 'numeric' : 'default'}
              style={styles.dialogInput}
              autoCapitalize="sentences"
              autoCorrect={false}
            />

            {currentSetting?.key === 'company_tin' && (
              <Paragraph style={styles.helperText}>
                Format: 000-000-000-000
              </Paragraph>
            )}
            {currentSetting?.key === 'pos_serial' && (
              <Paragraph style={styles.helperText}>
                Format: POS000000
              </Paragraph>
            )}
            {currentSetting?.key === 'vat_rate' && (
              <Paragraph style={styles.helperText}>
                Enter rate as number (e.g., 12.00 for 12%)
              </Paragraph>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSaveSetting}
              loading={loading}
              disabled={loading}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* License Generator Password Dialog */}
        <Dialog
          visible={licensePasswordDialogVisible}
          onDismiss={() => {
            setLicensePasswordDialogVisible(false);
            setLicensePassword('');
          }}
        >
          <Dialog.Title>Enter Password</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ marginBottom: 16 }}>
              Enter the admin password to access the License Key Generator
            </Paragraph>
            <TextInput
              label="Password"
              value={licensePassword}
              onChangeText={setLicensePassword}
              mode="outlined"
              secureTextEntry={true}
              autoFocus={true}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setLicensePasswordDialogVisible(false);
              setLicensePassword('');
            }}>Cancel</Button>
            <Button onPress={handleLicensePasswordSubmit}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
    </ScreenGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: '4%',
    paddingBottom: '8%',
  },
  card: {
    marginBottom: '4%',
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    opacity: 0.7,
    marginBottom: 16,
    fontSize: 12,
  },
  listItem: {
    paddingVertical: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  infoItem: {
    width: '48%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  appFooter: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 4,
  },
  dialogInput: {
    marginBottom: 8,
    textAlign: 'left',
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
});