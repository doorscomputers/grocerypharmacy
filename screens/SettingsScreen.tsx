import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as ExpoFileSystem from 'expo-file-system/legacy';
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
import { StableTextInput } from '../components/StableTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { ThemeName, themeDisplayNames } from '../utils/theme';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { DatabaseBackupService, BackupInfo } from '../utils/DatabaseBackupService';

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
  const [dbHealth, setDbHealth] = useState<{
    isHealthy: boolean;
    walMode: boolean;
    synchronousMode: string;
    integrityOk: boolean;
    estimatedSizeKB: number;
    issues: string[];
  } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [diskSpace, setDiskSpace] = useState<{ free: number; total: number } | null>(null);
  const [backupList, setBackupList] = useState<BackupInfo[]>([]);
  const [showBackupList, setShowBackupList] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const theme = useTheme();
  const { user } = useAuth();
  const { themeName, setTheme, availableThemes, colors } = useAppTheme();

  useEffect(() => {
    loadSettings();
    checkDatabaseHealth();
    checkDiskSpace();
  }, []);

  const checkDatabaseHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const dbService = getDatabase();
      const health = await dbService.checkDatabaseHealth();
      const dbInfo = await dbService.getDatabaseInfo();
      setDbHealth({
        isHealthy: health.isHealthy,
        walMode: health.walMode,
        synchronousMode: health.synchronousMode,
        integrityOk: health.integrityOk,
        estimatedSizeKB: dbInfo.estimatedSizeKB,
        issues: health.issues,
      });
    } catch (error) {
      console.error('Error checking database health:', error);
      setDbHealth({
        isHealthy: false,
        walMode: false,
        synchronousMode: 'UNKNOWN',
        integrityOk: false,
        estimatedSizeKB: 0,
        issues: [`Health check failed: ${error}`],
      });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  const checkDiskSpace = async () => {
    try {
      const isWebPlatform = Platform.OS === 'web';
      if (isWebPlatform) {
        // Web doesn't have direct disk space API
        setDiskSpace(null);
      } else if (ExpoFileSystem.getFreeDiskStorageAsync) {
        const free = await ExpoFileSystem.getFreeDiskStorageAsync();
        const total = await ExpoFileSystem.getTotalDiskCapacityAsync();
        setDiskSpace({
          free: Math.round(free / (1024 * 1024)), // Convert to MB
          total: Math.round(total / (1024 * 1024)), // Convert to MB
        });
      }
    } catch (error) {
      console.error('Error checking disk space:', error);
      setDiskSpace(null);
    }
  };

  const handleCheckpointWAL = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();
      const result = await dbService.checkpointWAL();
      if (result.success) {
        Alert.alert('Success', `WAL checkpoint completed. ${result.pagesCheckpointed} pages written to database.`);
      } else {
        Alert.alert('Warning', 'WAL checkpoint could not be completed.');
      }
    } catch (error) {
      Alert.alert('Error', `Checkpoint failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const dbService = getDatabase();
      const settingsData: Settings = {
        company_name: await dbService.getSetting('company_name') || 'Your Company Name',
        company_address: await dbService.getSetting('company_address') || 'Your Company Address',
        company_tin: await dbService.getSetting('company_tin') || '000-000-000-000',
        pos_serial: await dbService.getSetting('pos_serial') || 'POS000000',
        vat_rate: await dbService.getSetting('vat_rate') || '12.00',
        receipt_footer: await dbService.getSetting('receipt_footer') || 'Thank you for shopping with us! Come Again!!!',
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

  const loadBackupList = async () => {
    const isWebPlatform = Platform.OS === 'web';
    if (isWebPlatform) {
      Alert.alert('Info', 'Backup history is not available on web. Backups are downloaded directly to your device.');
      return;
    }

    setLoadingBackups(true);
    try {
      const backupService = DatabaseBackupService.getInstance();
      const backups = await backupService.listBackups();
      setBackupList(backups);
      setShowBackupList(true);
    } catch (error) {
      console.error('Error loading backups:', error);
      Alert.alert('Error', 'Failed to load backup list');
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleRestoreFromBackup = async (backup: BackupInfo) => {
    Alert.alert(
      'Restore Backup',
      `Restore from backup created on ${backup.timestamp.toLocaleString()}?\n\nThis will REPLACE all current data. This action cannot be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              setShowBackupList(false);

              const backupService = DatabaseBackupService.getInstance();
              // Create a safety backup first
              await backupService.createAutoBackup('pre-restore');

              // Read and restore
              const content = await FileSystem.readAsStringAsync(backup.filepath);
              const backupData = JSON.parse(content);

              if (!backupData.metadata || !backupData.tables) {
                throw new Error('Invalid backup format');
              }

              const { DatabaseService } = require('../database/DatabaseService');
              const dbService = DatabaseService.getInstance();
              const db = dbService.getDatabase();

              // Disable foreign keys
              await db.execAsync('PRAGMA foreign_keys = OFF');

              // Clear and restore tables
              const tables = Object.keys(backupData.tables);
              for (const tableName of tables) {
                const tableData = backupData.tables[tableName];
                if (Array.isArray(tableData) && tableData.length > 0) {
                  // Clear table
                  try {
                    await db.execAsync(`DELETE FROM ${tableName}`);
                  } catch (e) {
                    console.warn(`Could not clear table ${tableName}`);
                  }

                  // Restore data
                  const columns = Object.keys(tableData[0]);
                  const placeholders = columns.map(() => '?').join(', ');
                  const insertSql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

                  for (const row of tableData) {
                    const values = columns.map(col => row[col]);
                    try {
                      await db.runAsync(insertSql, values);
                    } catch (e) {
                      console.warn(`Could not insert into ${tableName}:`, e);
                    }
                  }
                }
              }

              // Re-enable foreign keys
              await db.execAsync('PRAGMA foreign_keys = ON');

              Alert.alert(
                'Restore Complete',
                'Database has been restored successfully. Please restart the app to ensure all changes take effect.',
                [{ text: 'OK', onPress: () => loadSettings() }]
              );
            } catch (error) {
              console.error('Restore error:', error);
              Alert.alert('Error', `Restore failed: ${error}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteBackup = async (backup: BackupInfo) => {
    Alert.alert(
      'Delete Backup',
      `Delete backup from ${backup.timestamp.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const backupService = DatabaseBackupService.getInstance();
              await backupService.deleteBackup(backup.filepath);
              // Refresh list
              const backups = await backupService.listBackups();
              setBackupList(backups);
              Alert.alert('Success', 'Backup deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete backup');
            }
          }
        }
      ]
    );
  };

  const handleShareBackup = async (backup: BackupInfo) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backup.filepath, {
          mimeType: 'application/json',
          dialogTitle: 'Share Backup File'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share backup');
    }
  };

  const handleBackup = async () => {
    Alert.alert(
      'Create Backup',
      'This will create a complete backup of ALL your data (products, transactions, settings, inventory, etc.). The share sheet will open so you can save to Google Drive, email, or other storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Backup',
          onPress: async () => {
            try {
              setLoading(true);

              const backupService = DatabaseBackupService.getInstance();
              const backupPath = await backupService.createBackup();

              // On native, open share sheet so user can save to Google Drive, etc.
              const isWebPlatform = Platform.OS === 'web';
              if (!isWebPlatform) {
                await backupService.shareBackup(backupPath);
              }

              Alert.alert('Success', 'Database backup created successfully! Save it to Google Drive or another safe location for easy restore later.');
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
      'This will replace ALL current data with data from a backup file. A safety backup will be created first.\n\nYou can pick a file from Google Drive, local storage, or any other source.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Backup File',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              const backupService = DatabaseBackupService.getInstance();

              // Create safety backup before restoring (native only)
              const isWebPlatform = Platform.OS === 'web';
              if (!isWebPlatform) {
                try {
                  await backupService.createAutoBackup('pre-restore');
                  console.log('[Restore] Safety backup created before restore');
                } catch (safetyError) {
                  console.warn('[Restore] Safety backup failed:', safetyError);
                }
              }

              // Use DatabaseBackupService which handles file picker + actual data restore
              const success = await backupService.restoreFromFile();

              if (success) {
                Alert.alert(
                  'Success',
                  'Database restored successfully. Please restart the app to ensure all changes take effect.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        loadSettings();
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
          {/* Profile Section */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>My Profile</Title>
              <Paragraph style={styles.cardSubtitle}>
                Manage your account settings
              </Paragraph>

              <List.Item
                title={user?.full_name || user?.username || 'User'}
                description={`${user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'MANAGER' ? 'Manager' : 'Cashier'} - Tap to view profile`}
                left={props => <List.Icon {...props} icon="account-circle" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('Profile')}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>

          {/* Appearance / Theme Selection */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Appearance</Title>
              <Paragraph style={styles.cardSubtitle}>
                Customize the look and feel of your POS
              </Paragraph>

              <Paragraph style={styles.themeLabel}>Color Theme</Paragraph>
              <View style={styles.themeOptions}>
                {availableThemes.map((themeOption) => {
                  const isSelected = themeName === themeOption.name;
                  const themeColors = {
                    teal: '#00796B',
                    blue: '#1565C0',
                    green: '#2E7D32',
                  };
                  const previewColor = themeColors[themeOption.name as keyof typeof themeColors];

                  return (
                    <Button
                      key={themeOption.name}
                      mode={isSelected ? 'contained' : 'outlined'}
                      onPress={() => setTheme(themeOption.name)}
                      style={[
                        styles.themeButton,
                        isSelected && { backgroundColor: previewColor },
                      ]}
                      labelStyle={[
                        styles.themeButtonLabel,
                        isSelected && { color: '#FFFFFF' },
                      ]}
                      contentStyle={styles.themeButtonContent}
                    >
                      {themeOption.displayName}
                    </Button>
                  );
                })}
              </View>

              <View style={[styles.themePreview, { borderColor: colors.primary }]}>
                <View style={[styles.themePreviewBar, { backgroundColor: colors.primary }]}>
                  <Paragraph style={styles.themePreviewText}>Preview</Paragraph>
                </View>
                <View style={styles.themePreviewContent}>
                  <View style={[styles.themePreviewDot, { backgroundColor: colors.primary }]} />
                  <View style={[styles.themePreviewDot, { backgroundColor: colors.accent }]} />
                  <View style={[styles.themePreviewDot, { backgroundColor: colors.success }]} />
                  <View style={[styles.themePreviewDot, { backgroundColor: colors.error }]} />
                </View>
              </View>
            </Card.Content>
          </Card>

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

          {/* Database Health & Protection */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Database Health & Protection</Title>
              <Paragraph style={styles.cardSubtitle}>
                Monitor database health and prevent data corruption
              </Paragraph>

              {/* Health Status Summary */}
              <View style={[styles.healthSummary, { backgroundColor: dbHealth?.isHealthy ? '#E8F5E9' : '#FFEBEE' }]}>
                <List.Icon
                  icon={dbHealth?.isHealthy ? 'check-circle' : 'alert-circle'}
                  color={dbHealth?.isHealthy ? '#4CAF50' : '#F44336'}
                />
                <View style={styles.healthSummaryText}>
                  <Paragraph style={{ fontWeight: 'bold', color: dbHealth?.isHealthy ? '#4CAF50' : '#F44336' }}>
                    {checkingHealth ? 'Checking...' : dbHealth?.isHealthy ? 'Database Healthy' : 'Issues Detected'}
                  </Paragraph>
                  {dbHealth?.estimatedSizeKB ? (
                    <Paragraph style={styles.healthDetail}>
                      Size: {dbHealth.estimatedSizeKB > 1024 ? `${(dbHealth.estimatedSizeKB / 1024).toFixed(1)} MB` : `${dbHealth.estimatedSizeKB} KB`}
                    </Paragraph>
                  ) : null}
                </View>
                <Button mode="text" onPress={checkDatabaseHealth} loading={checkingHealth} compact>
                  Refresh
                </Button>
              </View>

              {/* Health Details */}
              <List.Item
                title="WAL Mode (Crash Recovery)"
                description={dbHealth?.walMode ? 'Enabled - Better crash recovery' : 'Disabled - Enable for protection'}
                left={props => <List.Icon {...props} icon="shield-check" color={dbHealth?.walMode ? '#4CAF50' : '#FF9800'} />}
                right={() => (
                  <Paragraph style={{ color: dbHealth?.walMode ? '#4CAF50' : '#FF9800' }}>
                    {dbHealth?.walMode ? 'ON' : 'OFF'}
                  </Paragraph>
                )}
              />

              <Divider />

              <List.Item
                title="Synchronous Mode"
                description={dbHealth?.synchronousMode === 'FULL' ? 'Maximum durability' : 'May lose data on crash'}
                left={props => <List.Icon {...props} icon="sync" color={dbHealth?.synchronousMode === 'FULL' ? '#4CAF50' : '#FF9800'} />}
                right={() => (
                  <Paragraph style={{ color: dbHealth?.synchronousMode === 'FULL' ? '#4CAF50' : '#FF9800' }}>
                    {dbHealth?.synchronousMode || 'Unknown'}
                  </Paragraph>
                )}
              />

              <Divider />

              <List.Item
                title="Integrity Check"
                description={dbHealth?.integrityOk ? 'No corruption detected' : 'Database may be corrupted'}
                left={props => <List.Icon {...props} icon="database-check" color={dbHealth?.integrityOk ? '#4CAF50' : '#F44336'} />}
                right={() => (
                  <Paragraph style={{ color: dbHealth?.integrityOk ? '#4CAF50' : '#F44336' }}>
                    {dbHealth?.integrityOk ? 'OK' : 'FAILED'}
                  </Paragraph>
                )}
              />

              {diskSpace && (
                <>
                  <Divider />
                  <List.Item
                    title="Storage Space"
                    description={`${diskSpace.free.toLocaleString()} MB free of ${diskSpace.total.toLocaleString()} MB`}
                    left={props => <List.Icon {...props} icon="harddisk" color={diskSpace.free < 100 ? '#F44336' : '#4CAF50'} />}
                    right={() => (
                      <Paragraph style={{ color: diskSpace.free < 100 ? '#F44336' : '#4CAF50' }}>
                        {diskSpace.free < 100 ? 'LOW' : 'OK'}
                      </Paragraph>
                    )}
                  />
                </>
              )}

              {/* Issues List */}
              {dbHealth?.issues && dbHealth.issues.length > 0 && (
                <View style={styles.issuesContainer}>
                  <Paragraph style={styles.issuesTitle}>Issues Found:</Paragraph>
                  {dbHealth.issues.map((issue, index) => (
                    <Paragraph key={index} style={styles.issueItem}>• {issue}</Paragraph>
                  ))}
                </View>
              )}

              {/* Protection Actions */}
              <View style={styles.healthActions}>
                <Button
                  mode="outlined"
                  onPress={handleCheckpointWAL}
                  loading={loading}
                  icon="content-save"
                  style={styles.healthButton}
                >
                  Save to Disk
                </Button>
              </View>

              <Paragraph style={styles.healthNote}>
                Tip: Database protection is always enabled. Use "Save to Disk" before closing the app to ensure all changes are saved.
              </Paragraph>
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
                title="View Backups"
                description={`${backupList.length > 0 ? `${backupList.length} backup(s) available` : 'View and manage saved backups'}`}
                left={props => <List.Icon {...props} icon="folder-open" />}
                right={props => <Button mode="outlined" compact onPress={loadBackupList} loading={loadingBackups}>View</Button>}
                style={styles.listItem}
              />

              <Divider />

              <List.Item
                title="Restore Database"
                description="Import data from backup file"
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

          {/* Help & Support */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Help & Support</Title>
              <Paragraph style={styles.cardSubtitle}>
                User manual, tutorials, and support resources
              </Paragraph>

              <List.Item
                title="User Manual"
                description="View, print, or download the complete user guide"
                left={props => <List.Icon {...props} icon="book-open-page-variant" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => navigation.navigate('UserManual')}
                style={styles.listItem}
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
            <StableTextInput
              key={`${currentSetting?.key}-${dialogVisible}`}
              label={currentSetting?.label || ''}
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

        {/* Backup List Dialog */}
        <Dialog
          visible={showBackupList}
          onDismiss={() => setShowBackupList(false)}
          style={styles.backupDialog}
        >
          <Dialog.Title>Saved Backups</Dialog.Title>
          <Dialog.ScrollArea style={styles.backupScrollArea}>
            <ScrollView>
              {backupList.length === 0 ? (
                <Paragraph style={styles.noBackupsText}>
                  No backups found in the POSBackups folder.
                </Paragraph>
              ) : (
                backupList.map((backup, index) => (
                  <View key={backup.filename}>
                    <View style={styles.backupItem}>
                      <View style={styles.backupInfo}>
                        <Paragraph style={styles.backupDate}>
                          {backup.timestamp.toLocaleString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Paragraph>
                        <Paragraph style={styles.backupMeta}>
                          {backup.sizeKB} KB
                          {backup.metadata?.product_count ? ` • ${backup.metadata.product_count} products` : ''}
                          {backup.metadata?.backup_reason ? ` • ${backup.metadata.backup_reason}` : ''}
                        </Paragraph>
                      </View>
                      <View style={styles.backupActions}>
                        <Button
                          mode="text"
                          compact
                          icon="share"
                          onPress={() => handleShareBackup(backup)}
                        >
                          Share
                        </Button>
                        <Button
                          mode="text"
                          compact
                          icon="restore"
                          onPress={() => handleRestoreFromBackup(backup)}
                        >
                          Restore
                        </Button>
                        <Button
                          mode="text"
                          compact
                          icon="delete"
                          textColor="#F44336"
                          onPress={() => handleDeleteBackup(backup)}
                        >
                          Delete
                        </Button>
                      </View>
                    </View>
                    {index < backupList.length - 1 && <Divider />}
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowBackupList(false)}>Close</Button>
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
  healthSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  healthSummaryText: {
    flex: 1,
    marginLeft: 8,
  },
  healthDetail: {
    fontSize: 12,
    opacity: 0.7,
  },
  issuesContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  issuesTitle: {
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 8,
  },
  issueItem: {
    fontSize: 12,
    color: '#C62828',
    marginLeft: 8,
    marginBottom: 4,
  },
  healthActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  healthButton: {
    flex: 1,
  },
  healthNote: {
    fontSize: 11,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  backupDialog: {
    maxHeight: '80%',
  },
  backupScrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  backupItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backupInfo: {
    marginBottom: 8,
  },
  backupDate: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  backupMeta: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  backupActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  noBackupsText: {
    textAlign: 'center',
    padding: 24,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  // Theme selector styles
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  themeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  themeButton: {
    flex: 1,
    minWidth: 100,
  },
  themeButtonLabel: {
    fontSize: 12,
  },
  themeButtonContent: {
    paddingVertical: 4,
  },
  themePreview: {
    borderWidth: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  themePreviewBar: {
    padding: 8,
    alignItems: 'center',
  },
  themePreviewText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  themePreviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#F5F5F5',
  },
  themePreviewDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});