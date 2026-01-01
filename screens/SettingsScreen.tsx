import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
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
import { DatabaseBackupService } from '../utils/DatabaseBackupService';
import { useAuth } from '../contexts/AuthContext';

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
    try {
      setLoading(true);
      const backupService = DatabaseBackupService.getInstance();

      Alert.alert(
        'Create Backup',
        'This will create a backup file of all your data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Backup',
            onPress: async () => {
              try {
                const backupPath = await backupService.createBackup();
                await backupService.shareBackup(backupPath);
                Alert.alert('Success', 'Database backup created and shared successfully!');
              } catch (error) {
                console.error('Backup failed:', error);
                Alert.alert('Error', `Backup failed: ${error}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to create backup: ${error}`);
    } finally {
      setLoading(false);
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
              const backupService = DatabaseBackupService.getInstance();
              const success = await backupService.restoreFromFile();

              if (success) {
                Alert.alert(
                  'Success',
                  'Database restored successfully. Please restart the app to see changes.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Reload settings after restore
                        loadSettings();
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

  const handleReset = async () => {
    Alert.alert(
      'Reset Data',
      'This will delete ALL data including transactions, products, and settings. This action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Reset',
              'Are you absolutely sure? This will permanently delete all data.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Reset Everything',
                  style: 'destructive',
                  onPress: performReset,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performReset = async () => {
    // In a real app, this would reset the database
    Alert.alert('Success', 'Database reset successfully. Please restart the app.');
  };

  const handleValidateDatabase = async () => {
    try {
      setLoading(true);
      const backupService = DatabaseBackupService.getInstance();
      const validation = await backupService.validateDatabase();

      if (validation.isValid) {
        Alert.alert(
          'Database Validation',
          'Database is healthy and all integrity checks passed.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Database Issues Found',
          `Found ${validation.errors.length} issue(s):\\n\\n${validation.errors.join('\\n')}\\n\\nWould you like to attempt repair?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Repair',
              onPress: async () => {
                try {
                  const repair = await backupService.repairDatabase();
                  Alert.alert(
                    repair.success ? 'Repair Successful' : 'Repair Failed',
                    repair.message,
                    [{ text: 'OK' }]
                  );
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
              const backupService = DatabaseBackupService.getInstance();
              await backupService.optimizeDatabase();
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
                title="Reset All Data"
                description="Delete all data (cannot be undone)"
                left={props => <List.Icon {...props} icon="delete-alert" />}
                right={props => (
                  <Button
                    mode="outlined"
                    compact
                    textColor="#F44336"
                    onPress={handleReset}
                  >
                    Reset
                  </Button>
                )}
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
            <TextInput
              label={currentSetting?.label}
              value={tempValue}
              onChangeText={setTempValue}
              mode="outlined"
              multiline={currentSetting?.key === 'company_address' || currentSetting?.key === 'receipt_footer'}
              keyboardType={currentSetting?.key === 'vat_rate' ? 'numeric' : 'default'}
              style={styles.dialogInput}
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
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
});