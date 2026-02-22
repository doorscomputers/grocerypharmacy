import React, { useState, useEffect, useCallback } from 'react';
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
  List,
  useTheme,
  Dialog,
  Portal,
  TextInput,
  ActivityIndicator,
  Divider,
  Chip,
  RadioButton,
} from 'react-native-paper';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { ScreenGuard } from '../components/RoleGuard';
import { DatabaseBackupService } from '../utils/DatabaseBackupService';
import { Platform } from 'react-native';
import { useResponsiveTheme } from '../utils/responsive';

type ResetDataScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ResetData'
>;

type Props = {
  navigation: ResetDataScreenNavigationProp;
};

interface DataSummary {
  transactions: number;
  transaction_items: number;
  purchases: number;
  purchase_details: number;
  supplier_payments: number;
  customer_payments: number;
  accounts_payable: number;
  accounts_receivable: number;
  inventory_movements: number;
  sales_returns: number;
  sales_return_items: number;
  physical_count_sessions: number;
  physical_count_details: number;
  damaged_items_sessions: number;
  damaged_items_details: number;
  ejournal: number;
  x_readings: number;
  z_readings: number;
  end_of_day_records: number;
  shifts: number;
  cash_movements: number;
  customer_audit: number;
}

const CONFIRMATION_TEXT = 'RESET';

export default function ResetDataScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetType, setResetType] = useState<'standard' | 'with_beginning_inventory'>('standard');
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const { user } = useAuth();

  const loadDataSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const dbService = getDatabase();
      const summary = await dbService.getTransactionalDataSummary();
      setDataSummary(summary as DataSummary);
    } catch (error) {
      console.error('Error loading data summary:', error);
      Alert.alert('Error', 'Failed to load data summary');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    loadDataSummary();
  }, [loadDataSummary]);

  const getTotalRecords = (): number => {
    if (!dataSummary) return 0;
    return Object.values(dataSummary).reduce((sum, count) => sum + count, 0);
  };

  const handleResetPress = () => {
    if (!user || user.role !== 'ADMIN') {
      Alert.alert(
        'Access Denied',
        'Only administrators can reset transactional data.',
        [{ text: 'OK' }]
      );
      return;
    }

    setDialogVisible(true);
    setConfirmationText('');
    setAdminPassword('');
    setPasswordError('');
  };

  // Helper to log reset operations
  const logResetOperation = async (
    status: 'ATTEMPTED' | 'SUCCESS' | 'FAILED' | 'DENIED' | 'CANCELLED',
    recordsDeleted: number = 0,
    details?: Record<string, any>
  ) => {
    if (!user) return;
    try {
      const dbService = getDatabase();
      await dbService.logResetOperation({
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        operationType: 'TRANSACTIONAL_DATA_RESET',
        status,
        recordsDeleted,
        details,
      });
    } catch (error) {
      console.error('[Reset] Error logging operation:', error);
    }
  };

  const handleCancelDialog = async () => {
    // Log cancellation if user had started the process
    if (confirmationText.length > 0 || adminPassword.length > 0) {
      await logResetOperation('CANCELLED', 0, { reason: 'User cancelled dialog' });
    }
    setDialogVisible(false);
    setConfirmationText('');
    setAdminPassword('');
    setPasswordError('');
  };

  const handleConfirmReset = async () => {
    if (confirmationText !== CONFIRMATION_TEXT) {
      Alert.alert('Error', `Please type "${CONFIRMATION_TEXT}" to confirm.`);
      return;
    }

    if (!adminPassword.trim()) {
      setPasswordError('Please enter your admin password');
      return;
    }

    // Verify admin password first
    setVerifyingPassword(true);
    setPasswordError('');
    try {
      const dbService = getDatabase();
      const isValidPassword = await dbService.verifyAdminPassword(adminPassword);

      if (!isValidPassword) {
        setPasswordError('Incorrect admin password');
        setVerifyingPassword(false);
        // Log denied access
        await logResetOperation('DENIED', 0, { reason: 'Invalid admin password' });
        return;
      }
    } catch (error) {
      setPasswordError('Error verifying password');
      setVerifyingPassword(false);
      await logResetOperation('FAILED', 0, { reason: 'Password verification error', error: String(error) });
      return;
    }
    setVerifyingPassword(false);

    // Log that reset was attempted
    await logResetOperation('ATTEMPTED', 0, { totalRecords: getTotalRecords() });

    setResetting(true);
    try {
      // Create auto-backup before reset (native only)
      const isWebPlatform = Platform.OS === 'web';
      let backupPath: string | null = null;

      if (!isWebPlatform) {
        try {
          const backupService = DatabaseBackupService.getInstance();
          backupPath = await backupService.createAutoBackup('pre-reset');
          console.log('[Reset] Auto-backup created:', backupPath);
        } catch (backupError) {
          console.warn('[Reset] Auto-backup failed:', backupError);
          // Continue with reset even if backup fails
        }
      }

      const dbService = getDatabase();

      // Call appropriate reset method based on resetType
      let result: { success: boolean; deletedCounts: Record<string, number>; errors: string[]; productsInitialized?: number };
      if (resetType === 'with_beginning_inventory' && user) {
        result = await dbService.resetTransactionalDataWithBeginningInventory(user.id);
      } else {
        result = await dbService.resetTransactionalData();
      }

      setDialogVisible(false);
      setConfirmationText('');

      if (result.success) {
        const totalDeleted = Object.values(result.deletedCounts).reduce((sum: number, count: number) => sum + count, 0);
        // Log successful reset
        await logResetOperation('SUCCESS', totalDeleted, {
          deletedCounts: result.deletedCounts,
          backupCreated: !!backupPath,
          resetType,
          productsInitialized: result.productsInitialized
        });
        const backupMsg = backupPath ? '\n\nA backup was created before the reset.' : '';
        const stockMsg = resetType === 'with_beginning_inventory'
          ? `\n\n${result.productsInitialized || 0} products initialized with 100 units each and Beginning Balance inventory records created.`
          : '\n\nStock quantities have been reset to zero.';
        Alert.alert(
          'Reset Complete',
          `Successfully deleted ${totalDeleted} records.\n\nAll transactional data has been cleared. Master data (Products, Suppliers, Customers, Categories, etc.) has been preserved.${stockMsg}${backupMsg}`,
          [
            {
              text: 'OK',
              onPress: () => {
                loadDataSummary();
              }
            }
          ]
        );
      } else {
        const totalDeleted = Object.values(result.deletedCounts).reduce((sum: number, count: number) => sum + count, 0);
        // Log partial success (completed with warnings)
        await logResetOperation('SUCCESS', totalDeleted, {
          deletedCounts: result.deletedCounts,
          errors: result.errors,
          hasWarnings: true,
          resetType,
          productsInitialized: result.productsInitialized
        });
        const stockMsg = resetType === 'with_beginning_inventory'
          ? `\n\n${result.productsInitialized || 0} products were initialized with beginning inventory.`
          : '';
        Alert.alert(
          'Reset Completed with Warnings',
          `Reset completed but encountered some errors:\n\n${result.errors.join('\n')}\n\nMost data was cleared successfully.${stockMsg}`,
          [
            {
              text: 'OK',
              onPress: () => {
                loadDataSummary();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error resetting data:', error);
      // Log failed reset
      await logResetOperation('FAILED', 0, { error: String(error) });
      Alert.alert('Error', `Failed to reset data: ${error}`);
    } finally {
      setResetting(false);
    }
  };

  const formatTableName = (name: string): string => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getDataCategories = () => {
    if (!dataSummary) return [];

    return [
      {
        title: 'Sales Data',
        icon: 'cash-register',
        items: [
          { label: 'Transactions', count: dataSummary.transactions },
          { label: 'Transaction Items', count: dataSummary.transaction_items },
          { label: 'Sales Returns', count: dataSummary.sales_returns },
          { label: 'Sales Return Items', count: dataSummary.sales_return_items },
        ]
      },
      {
        title: 'Purchase Data',
        icon: 'truck-delivery',
        items: [
          { label: 'Purchases', count: dataSummary.purchases },
          { label: 'Purchase Details', count: dataSummary.purchase_details },
          { label: 'Supplier Payments', count: dataSummary.supplier_payments },
          { label: 'Accounts Payable', count: dataSummary.accounts_payable },
        ]
      },
      {
        title: 'Customer Data',
        icon: 'account-group',
        items: [
          { label: 'Customer Payments', count: dataSummary.customer_payments },
          { label: 'Accounts Receivable', count: dataSummary.accounts_receivable },
          { label: 'Customer Audit Trail', count: dataSummary.customer_audit },
        ]
      },
      {
        title: 'Inventory Data',
        icon: 'package-variant',
        items: [
          { label: 'Inventory Movements', count: dataSummary.inventory_movements },
          { label: 'Physical Count Sessions', count: dataSummary.physical_count_sessions },
          { label: 'Physical Count Details', count: dataSummary.physical_count_details },
          { label: 'Damaged Items Sessions', count: dataSummary.damaged_items_sessions },
          { label: 'Damaged Items Details', count: dataSummary.damaged_items_details },
        ]
      },
      {
        title: 'BIR & Compliance',
        icon: 'file-document',
        items: [
          { label: 'E-Journal Entries', count: dataSummary.ejournal },
          { label: 'X-Readings', count: dataSummary.x_readings },
          { label: 'Z-Readings', count: dataSummary.z_readings },
        ]
      },
      {
        title: 'Operations Data',
        icon: 'calendar-clock',
        items: [
          { label: 'End of Day Records', count: dataSummary.end_of_day_records },
          { label: 'Shifts', count: dataSummary.shifts },
          { label: 'Cash Movements', count: dataSummary.cash_movements },
        ]
      },
    ];
  };

  return (
    <ScreenGuard screenName="Settings">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView style={styles.scrollView}>
          <View style={[styles.content, { padding: lo.screenPadding }]}>
            {/* Warning Card */}
            <Card style={[styles.card, styles.warningCard]}>
              <Card.Content>
                <View style={styles.warningHeader}>
                  <List.Icon icon="alert-circle" color="#F44336" />
                  <Title style={styles.warningTitle}>Reset Transactional Data</Title>
                </View>
                <Paragraph style={styles.warningText}>
                  This action will permanently delete all transactional data including sales, purchases,
                  payments, inventory movements, BIR readings, and related records.
                </Paragraph>
                <Paragraph style={[styles.warningText, { fontWeight: 'bold', marginTop: 8 }]}>
                  This action CANNOT be undone!
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Preserved Data Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.cardTitle, { fontSize: fs.h3 }]}>Data That Will Be PRESERVED</Title>
                <Paragraph style={[styles.cardSubtitle, { fontSize: fs.bodySmall }]}>
                  The following master data will NOT be deleted:
                </Paragraph>
                <View style={styles.chipContainer}>
                  <Chip icon="check" style={styles.preserveChip}>Products</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Suppliers</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Customers</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Categories</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Brands</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Units</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Sizes</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Users</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Settings</Chip>
                  <Chip icon="check" style={styles.preserveChip}>Permissions</Chip>
                </View>
                <Paragraph style={[styles.noteText, { marginTop: 12 }]}>
                  Note: Product stock quantities will be {resetType === 'standard' ? 'reset to zero' : 'set to 100 units each'}.
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Reset Type Selection Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.cardTitle, { fontSize: fs.h3 }]}>Reset Type</Title>
                <Paragraph style={[styles.cardSubtitle, { fontSize: fs.bodySmall }]}>
                  Choose how to handle product inventory after reset:
                </Paragraph>
                <RadioButton.Group onValueChange={value => setResetType(value as 'standard' | 'with_beginning_inventory')} value={resetType}>
                  <View style={styles.radioOption}>
                    <RadioButton.Item
                      label="Reset to Zero Stock"
                      value="standard"
                      style={styles.radioItem}
                    />
                    <Paragraph style={styles.radioDescription}>
                      All product stock quantities will be set to 0. No inventory movement records will be created.
                    </Paragraph>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.radioOption}>
                    <RadioButton.Item
                      label="Reset with Beginning Inventory (100 units)"
                      value="with_beginning_inventory"
                      style={styles.radioItem}
                    />
                    <Paragraph style={styles.radioDescription}>
                      All active products will be set to 100 units with a "Beginning Balance" inventory movement record for audit trail.
                    </Paragraph>
                  </View>
                </RadioButton.Group>
              </Card.Content>
            </Card>

            {/* Data Summary Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.cardTitle, { fontSize: fs.h3 }]}>Data That Will Be DELETED</Title>
                <Paragraph style={[styles.cardSubtitle, { fontSize: fs.bodySmall }]}>
                  Review the data that will be permanently removed:
                </Paragraph>

                {loadingSummary ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator animating={true} size="large" />
                    <Paragraph style={styles.loadingText}>Loading data summary...</Paragraph>
                  </View>
                ) : (
                  <>
                    <View style={styles.totalContainer}>
                      <Paragraph style={styles.totalLabel}>Total Records to Delete:</Paragraph>
                      <Paragraph style={styles.totalCount}>{getTotalRecords().toLocaleString()}</Paragraph>
                    </View>

                    <Divider style={styles.divider} />

                    {getDataCategories().map((category, index) => (
                      <View key={index}>
                        <List.Accordion
                          title={category.title}
                          left={props => <List.Icon {...props} icon={category.icon} />}
                          right={props => (
                            <Chip compact style={styles.countChip}>
                              {category.items.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                            </Chip>
                          )}
                        >
                          {category.items.map((item, itemIndex) => (
                            <List.Item
                              key={itemIndex}
                              title={item.label}
                              right={() => (
                                <Paragraph style={item.count > 0 ? styles.itemCountActive : styles.itemCount}>
                                  {item.count.toLocaleString()}
                                </Paragraph>
                              )}
                              style={styles.subItem}
                            />
                          ))}
                        </List.Accordion>
                        {index < getDataCategories().length - 1 && <Divider />}
                      </View>
                    ))}
                  </>
                )}
              </Card.Content>
            </Card>

            {/* Reset Button */}
            <Card style={styles.card}>
              <Card.Content>
                <Button
                  mode="contained"
                  onPress={handleResetPress}
                  loading={loading}
                  disabled={loading || loadingSummary || getTotalRecords() === 0}
                  style={styles.resetButton}
                  buttonColor="#F44336"
                  icon="delete-forever"
                >
                  {getTotalRecords() === 0 ? 'No Data to Reset' : 'Reset Transactional Data'}
                </Button>
                <Paragraph style={styles.buttonNote}>
                  {getTotalRecords() === 0
                    ? 'There is no transactional data to reset.'
                    : 'You will be asked to confirm before any data is deleted.'}
                </Paragraph>
              </Card.Content>
            </Card>
          </View>
        </ScrollView>

        {/* Confirmation Dialog */}
        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => !resetting && handleCancelDialog()}>
            <Dialog.Title style={styles.dialogTitle}>
              Confirm Data Reset
            </Dialog.Title>
            <Dialog.Content>
              <Paragraph style={styles.dialogText}>
                You are about to delete {getTotalRecords().toLocaleString()} records permanently.
              </Paragraph>
              <Paragraph style={[styles.dialogText, { marginTop: 12, fontWeight: 'bold' }]}>
                This action cannot be undone!
              </Paragraph>
              <Paragraph style={[styles.dialogText, { marginTop: 16 }]}>
                Type "{CONFIRMATION_TEXT}" below to confirm:
              </Paragraph>
              <TextInput
                mode="outlined"
                value={confirmationText}
                onChangeText={setConfirmationText}
                placeholder={`Type ${CONFIRMATION_TEXT} here`}
                autoCapitalize="characters"
                style={styles.confirmInput}
                disabled={resetting || verifyingPassword}
              />
              <Paragraph style={[styles.dialogText, { marginTop: 16 }]}>
                Enter your admin password:
              </Paragraph>
              <TextInput
                mode="outlined"
                value={adminPassword}
                onChangeText={(text) => {
                  setAdminPassword(text);
                  setPasswordError('');
                }}
                placeholder="Admin password"
                secureTextEntry
                style={styles.confirmInput}
                disabled={resetting || verifyingPassword}
                error={!!passwordError}
              />
              {passwordError ? (
                <Paragraph style={styles.errorText}>{passwordError}</Paragraph>
              ) : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={handleCancelDialog}
                disabled={resetting || verifyingPassword}
              >
                Cancel
              </Button>
              <Button
                onPress={handleConfirmReset}
                loading={resetting || verifyingPassword}
                disabled={resetting || verifyingPassword || confirmationText !== CONFIRMATION_TEXT || !adminPassword.trim()}
                textColor="#F44336"
              >
                Reset All Data
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
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
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    color: '#F44336',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningText: {
    color: '#666',
    lineHeight: 22,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    opacity: 0.7,
    marginBottom: 16,
    fontSize: 13,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preserveChip: {
    backgroundColor: '#E8F5E9',
  },
  noteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#FF9800',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F44336',
  },
  divider: {
    marginVertical: 8,
  },
  countChip: {
    backgroundColor: '#FFEBEE',
  },
  subItem: {
    paddingLeft: 32,
  },
  itemCount: {
    color: '#999',
  },
  itemCountActive: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  resetButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  buttonNote: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    opacity: 0.7,
  },
  dialogTitle: {
    color: '#F44336',
  },
  dialogText: {
    lineHeight: 22,
  },
  confirmInput: {
    marginTop: 12,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
  radioOption: {
    marginBottom: 4,
  },
  radioItem: {
    paddingVertical: 4,
  },
  radioDescription: {
    paddingLeft: 52,
    fontSize: 12,
    opacity: 0.7,
    marginTop: -8,
    marginBottom: 8,
  },
});
