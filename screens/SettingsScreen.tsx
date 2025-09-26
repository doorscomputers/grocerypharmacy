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
import { DatabaseService } from '../database/DatabaseService';

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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const dbService = DatabaseService.getInstance();
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

    setLoading(true);
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.updateSetting(currentSetting.key, tempValue);

      setSettings(prev => ({
        ...prev,
        [currentSetting.key]: tempValue
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
      'Backup Database',
      'Export database backup feature would be implemented here.',
      [{ text: 'OK' }]
    );
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore Database',
      'Import database restore feature would be implemented here.',
      [{ text: 'OK' }]
    );
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
            {currentSetting?.key === 'permit_number' && (
              <Paragraph style={styles.helperText}>
                Format: FP-000000000-000
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