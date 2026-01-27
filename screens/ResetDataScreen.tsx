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
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { ScreenGuard } from '../components/RoleGuard';

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
  const [resetting, setResetting] = useState(false);
  const theme = useTheme();
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
  };

  const handleConfirmReset = async () => {
    if (confirmationText !== CONFIRMATION_TEXT) {
      Alert.alert('Error', `Please type "${CONFIRMATION_TEXT}" to confirm.`);
      return;
    }

    setResetting(true);
    try {
      const dbService = getDatabase();
      const result = await dbService.resetTransactionalData();

      setDialogVisible(false);
      setConfirmationText('');

      if (result.success) {
        const totalDeleted = Object.values(result.deletedCounts).reduce((sum: number, count: number) => sum + count, 0);
        Alert.alert(
          'Reset Complete',
          `Successfully deleted ${totalDeleted} records.\n\nAll transactional data has been cleared. Master data (Products, Suppliers, Customers, Categories, etc.) has been preserved.\n\nStock quantities have been reset to zero.`,
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
        Alert.alert(
          'Reset Completed with Warnings',
          `Reset completed but encountered some errors:\n\n${result.errors.join('\n')}\n\nMost data was cleared successfully.`,
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
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
                <Title style={styles.cardTitle}>Data That Will Be PRESERVED</Title>
                <Paragraph style={styles.cardSubtitle}>
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
                  Note: Product stock quantities will be reset to zero.
                </Paragraph>
              </Card.Content>
            </Card>

            {/* Data Summary Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.cardTitle}>Data That Will Be DELETED</Title>
                <Paragraph style={styles.cardSubtitle}>
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
          <Dialog visible={dialogVisible} onDismiss={() => !resetting && setDialogVisible(false)}>
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
                disabled={resetting}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setDialogVisible(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                onPress={handleConfirmReset}
                loading={resetting}
                disabled={resetting || confirmationText !== CONFIRMATION_TEXT}
                textColor="#F44336"
              >
                Reset All Data
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
});
