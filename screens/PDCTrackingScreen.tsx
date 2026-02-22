import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  Dialog,
  Portal,
  Chip,
  Menu,
  Divider,
  RadioButton,
  Badge,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useResponsiveTheme } from '../utils/responsive';

type PDCTrackingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PDCTracking'
>;

type Props = {
  navigation: PDCTrackingScreenNavigationProp;
};

type ChequeStatus = 'ALL' | 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED';
type BouncedReason = 'INSUFFICIENT_FUNDS' | 'ACCOUNT_CLOSED' | 'SIGNATURE_MISMATCH' | 'POST_DATED' | 'STALE_EXPIRED' | 'OTHER';

const BOUNCED_REASONS: { value: BouncedReason; label: string }[] = [
  { value: 'INSUFFICIENT_FUNDS', label: 'Insufficient Funds (DAIF)' },
  { value: 'ACCOUNT_CLOSED', label: 'Account Closed' },
  { value: 'SIGNATURE_MISMATCH', label: 'Signature Mismatch' },
  { value: 'POST_DATED', label: 'Post-Dated (Not Yet Due)' },
  { value: 'STALE_EXPIRED', label: 'Stale/Expired Cheque' },
  { value: 'OTHER', label: 'Other Reason' },
];

export default function PDCTrackingScreen({ navigation }: Props) {
  const [cheques, setCheques] = useState<any[]>([]);
  const [filteredCheques, setFilteredCheques] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<ChequeStatus>('ALL');
  const [loading, setLoading] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);

  // Status Update Dialog
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<'DEPOSITED' | 'CLEARED' | 'BOUNCED'>('DEPOSITED');
  const [bouncedReason, setBouncedReason] = useState<BouncedReason>('INSUFFICIENT_FUNDS');
  const [bouncedReasonMenuVisible, setBouncedReasonMenuVisible] = useState(false);

  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (statusFilter === 'ALL') {
      setFilteredCheques(cheques);
    } else {
      setFilteredCheques(cheques.filter(c => c.cheque_status === statusFilter));
    }
  }, [cheques, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const [chequesData, alertsData] = await Promise.all([
        dbService.getChequePayments(),
        dbService.getPDCAlerts(7),
      ]);

      setCheques(chequesData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading PDC data:', error);
      Alert.alert('Error', 'Failed to load PDC data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#FF9800';
      case 'DEPOSITED': return '#2196F3';
      case 'CLEARED': return '#4CAF50';
      case 'BOUNCED': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return '#F44336';
      case 'MEDIUM': return '#FF9800';
      case 'LOW': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const openStatusDialog = (cheque: any) => {
    setSelectedCheque(cheque);
    setNewStatus('DEPOSITED');
    setBouncedReason('INSUFFICIENT_FUNDS');
    setStatusDialogVisible(true);
  };

  const updateChequeStatus = async () => {
    if (!selectedCheque) return;

    try {
      setLoading(true);
      const dbService = getDatabase();

      await dbService.updateChequeStatus(
        selectedCheque.id,
        newStatus,
        {
          bounced_reason: newStatus === 'BOUNCED' ? bouncedReason : undefined,
          updated_by: 1, // TODO: Get from user context
        }
      );

      let message = `Cheque ${selectedCheque.cheque_number} marked as ${newStatus}`;
      if (newStatus === 'BOUNCED') {
        message += `\n\nThe payment amount of ₱${selectedCheque.amount.toLocaleString()} has been restored to Accounts Payable.`;
      }

      Alert.alert('Success', message, [
        {
          text: 'OK',
          onPress: () => {
            setStatusDialogVisible(false);
            loadData();
          }
        }
      ]);
    } catch (error) {
      console.error('Error updating cheque status:', error);
      Alert.alert('Error', 'Failed to update cheque status');
    } finally {
      setLoading(false);
    }
  };

  const getSummary = () => {
    const pending = cheques.filter(c => c.cheque_status === 'PENDING');
    const deposited = cheques.filter(c => c.cheque_status === 'DEPOSITED');
    const cleared = cheques.filter(c => c.cheque_status === 'CLEARED');
    const bounced = cheques.filter(c => c.cheque_status === 'BOUNCED');

    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, c) => sum + c.amount, 0),
      depositedCount: deposited.length,
      depositedAmount: deposited.reduce((sum, c) => sum + c.amount, 0),
      clearedCount: cleared.length,
      clearedAmount: cleared.reduce((sum, c) => sum + c.amount, 0),
      bouncedCount: bounced.length,
      bouncedAmount: bounced.reduce((sum, c) => sum + c.amount, 0),
    };
  };

  const summary = getSummary();

  const renderAlert = ({ item }: { item: any }) => (
    <Card style={[styles.alertCard, { borderLeftColor: getAlertColor(item.priority) }]}>
      <Card.Content>
        <View style={styles.alertHeader}>
          <View style={styles.alertInfo}>
            <Title style={styles.alertChequeNumber}>{item.cheque_number}</Title>
            <Paragraph style={styles.alertSupplier}>{item.supplier_name}</Paragraph>
          </View>
          <View style={styles.alertDetails}>
            <Chip
              style={[styles.alertChip, { backgroundColor: getAlertColor(item.priority) }]}
              textStyle={{ color: 'white', fontSize: 10 }}
            >
              {item.alert_type === 'PAST_DUE' ? `${item.days_overdue} days overdue` : `Due in ${item.days_until_due} days`}
            </Chip>
            <Paragraph style={styles.alertAmount}>₱{item.amount.toLocaleString()}</Paragraph>
          </View>
        </View>
        <Paragraph style={styles.alertDate}>
          Cheque Date: {new Date(item.cheque_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
        </Paragraph>
      </Card.Content>
    </Card>
  );

  const renderCheque = ({ item }: { item: any }) => {
    const canUpdateStatus = item.cheque_status !== 'CLEARED' && item.cheque_status !== 'BOUNCED';

    return (
      <Card style={styles.chequeCard}>
        <Card.Content>
          <View style={styles.chequeHeader}>
            <View style={styles.chequeInfo}>
              <Title style={styles.chequeNumber}>{item.cheque_number}</Title>
              <Paragraph style={styles.bankName}>{item.bank_name}</Paragraph>
              <Paragraph style={styles.supplierName}>{item.supplier_name}</Paragraph>
            </View>
            <View style={styles.chequeDetails}>
              <Chip
                style={[styles.statusChip, { backgroundColor: getStatusColor(item.cheque_status) }]}
                textStyle={{ color: 'white' }}
              >
                {item.cheque_status}
              </Chip>
              <Paragraph style={styles.chequeAmount}>₱{item.amount.toLocaleString()}</Paragraph>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.chequeDetailsRow}>
            <View style={styles.detailItem}>
              <Paragraph style={styles.detailLabel}>Payee</Paragraph>
              <Paragraph style={styles.detailValue}>{item.payee_name}</Paragraph>
            </View>
            <View style={styles.detailItem}>
              <Paragraph style={styles.detailLabel}>Cheque Date</Paragraph>
              <Paragraph style={styles.detailValue}>
                {item.cheque_date ? new Date(item.cheque_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : 'N/A'}
              </Paragraph>
            </View>
          </View>

          {/* Status History */}
          <View style={styles.statusHistory}>
            {item.deposited_date && (
              <Paragraph style={styles.statusDate}>
                Deposited: {new Date(item.deposited_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
              </Paragraph>
            )}
            {item.cleared_date && (
              <Paragraph style={styles.statusDate}>
                Cleared: {new Date(item.cleared_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
              </Paragraph>
            )}
            {item.bounced_date && (
              <Paragraph style={[styles.statusDate, { color: '#F44336' }]}>
                Bounced: {new Date(item.bounced_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
                {item.bounced_reason && ` (${item.bounced_reason.replace('_', ' ')})`}
              </Paragraph>
            )}
          </View>

          {canUpdateStatus && (
            <Button
              mode="contained"
              onPress={() => openStatusDialog(item)}
              style={styles.updateButton}
              compact
            >
              Update Status
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: lo.screenPadding }]}>
        <Title style={[styles.headerTitle, { fontSize: fs.h2 }]}>PDC Tracking</Title>
        <Paragraph style={styles.headerSubtitle}>Post-Dated Cheque Management</Paragraph>
      </View>

      {/* Summary Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryContainer}>
        <Card style={[styles.summaryCard, { backgroundColor: '#FFF3E0' }]}>
          <Card.Content>
            <Paragraph style={styles.summaryLabel}>Pending</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#FF9800' }]}>
              ₱{summary.pendingAmount.toLocaleString()}
            </Title>
            <Paragraph style={styles.summaryCount}>{summary.pendingCount} cheques</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content>
            <Paragraph style={styles.summaryLabel}>Deposited</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#2196F3' }]}>
              ₱{summary.depositedAmount.toLocaleString()}
            </Title>
            <Paragraph style={styles.summaryCount}>{summary.depositedCount} cheques</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
          <Card.Content>
            <Paragraph style={styles.summaryLabel}>Cleared</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#4CAF50' }]}>
              ₱{summary.clearedAmount.toLocaleString()}
            </Title>
            <Paragraph style={styles.summaryCount}>{summary.clearedCount} cheques</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: '#FFEBEE' }]}>
          <Card.Content>
            <Paragraph style={styles.summaryLabel}>Bounced</Paragraph>
            <Title style={[styles.summaryAmount, { color: '#F44336' }]}>
              ₱{summary.bouncedAmount.toLocaleString()}
            </Title>
            <Paragraph style={styles.summaryCount}>{summary.bouncedCount} cheques</Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Alerts Section */}
      {alerts.length > 0 && showAlerts && (
        <Card style={styles.alertsContainer}>
          <Card.Content>
            <View style={styles.alertsHeader}>
              <View style={styles.alertsTitleRow}>
                <Title style={styles.alertsTitle}>Alerts</Title>
                <Badge style={styles.alertsBadge}>{alerts.length}</Badge>
              </View>
              <Button compact onPress={() => setShowAlerts(false)}>Hide</Button>
            </View>
            <FlatList
              data={alerts}
              keyExtractor={(item) => `alert-${item.id}`}
              renderItem={renderAlert}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          </Card.Content>
        </Card>
      )}

      {!showAlerts && alerts.length > 0 && (
        <Button onPress={() => setShowAlerts(true)} style={styles.showAlertsButton}>
          Show {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
        </Button>
      )}

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['ALL', 'PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED'] as ChequeStatus[]).map(status => (
            <Chip
              key={status}
              selected={statusFilter === status}
              onPress={() => setStatusFilter(status)}
              style={styles.filterChip}
              selectedColor={status === 'ALL' ? theme.colors.primary : getStatusColor(status)}
            >
              {status}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Cheques List */}
      <FlatList
        data={filteredCheques}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCheque}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Paragraph style={styles.emptyText}>
              No cheque payments found.
            </Paragraph>
          </View>
        }
      />

      {/* Status Update Dialog */}
      <Portal>
        <Dialog visible={statusDialogVisible} onDismiss={() => setStatusDialogVisible(false)}>
          <Dialog.Title>Update Cheque Status</Dialog.Title>
          <Dialog.Content>
            {selectedCheque && (
              <View>
                <Paragraph style={styles.dialogChequeInfo}>
                  Cheque: {selectedCheque.cheque_number}
                </Paragraph>
                <Paragraph style={styles.dialogChequeInfo}>
                  Amount: ₱{selectedCheque.amount.toLocaleString()}
                </Paragraph>
                <Paragraph style={styles.dialogChequeInfo}>
                  Current Status: {selectedCheque.cheque_status}
                </Paragraph>

                <Divider style={styles.divider} />

                <Paragraph style={styles.selectLabel}>New Status:</Paragraph>
                <RadioButton.Group
                  onValueChange={(value) => setNewStatus(value as any)}
                  value={newStatus}
                >
                  {selectedCheque.cheque_status === 'PENDING' && (
                    <RadioButton.Item label="Deposited (submitted to bank)" value="DEPOSITED" />
                  )}
                  {(selectedCheque.cheque_status === 'PENDING' || selectedCheque.cheque_status === 'DEPOSITED') && (
                    <RadioButton.Item label="Cleared (payment confirmed)" value="CLEARED" />
                  )}
                  {selectedCheque.cheque_status !== 'CLEARED' && selectedCheque.cheque_status !== 'BOUNCED' && (
                    <RadioButton.Item label="Bounced (cheque rejected)" value="BOUNCED" />
                  )}
                </RadioButton.Group>

                {newStatus === 'BOUNCED' && (
                  <View style={styles.bouncedReasonContainer}>
                    <Paragraph style={styles.selectLabel}>Bounced Reason:</Paragraph>
                    <Menu
                      visible={bouncedReasonMenuVisible}
                      onDismiss={() => setBouncedReasonMenuVisible(false)}
                      anchor={
                        <Button
                          mode="outlined"
                          onPress={() => setBouncedReasonMenuVisible(true)}
                          style={styles.reasonButton}
                          icon="chevron-down"
                        >
                          {BOUNCED_REASONS.find(r => r.value === bouncedReason)?.label || 'Select Reason'}
                        </Button>
                      }
                      contentStyle={{ backgroundColor: '#ffffff' }}
                    >
                      {BOUNCED_REASONS.map(reason => (
                        <Menu.Item
                          key={reason.value}
                          onPress={() => {
                            setBouncedReason(reason.value);
                            setBouncedReasonMenuVisible(false);
                          }}
                          title={reason.label}
                          style={{ backgroundColor: '#ffffff' }}
                        />
                      ))}
                    </Menu>

                    <Card style={styles.warningCard}>
                      <Card.Content>
                        <Paragraph style={styles.warningText}>
                          Marking this cheque as BOUNCED will restore the payment amount of ₱{selectedCheque.amount.toLocaleString()} back to Accounts Payable.
                        </Paragraph>
                      </Card.Content>
                    </Card>
                  </View>
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStatusDialogVisible(false)}>Cancel</Button>
            <Button onPress={updateChequeStatus} loading={loading}>
              Update Status
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  summaryCard: {
    marginRight: 12,
    minWidth: 140,
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryCount: {
    fontSize: 11,
    opacity: 0.6,
  },
  alertsContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFF8E1',
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertsBadge: {
    marginLeft: 8,
    backgroundColor: '#F44336',
  },
  alertCard: {
    marginRight: 12,
    minWidth: 200,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  alertInfo: {
    flex: 1,
  },
  alertChequeNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertSupplier: {
    fontSize: 12,
    opacity: 0.7,
  },
  alertDetails: {
    alignItems: 'flex-end',
  },
  alertChip: {
    marginBottom: 4,
  },
  alertAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertDate: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 4,
  },
  showAlertsButton: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  chequeCard: {
    marginBottom: 16,
    elevation: 4,
  },
  chequeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chequeInfo: {
    flex: 1,
  },
  chequeNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  bankName: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 2,
  },
  supplierName: {
    fontSize: 12,
    opacity: 0.7,
  },
  chequeDetails: {
    alignItems: 'flex-end',
  },
  statusChip: {
    marginBottom: 8,
  },
  chequeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  divider: {
    marginVertical: 12,
  },
  chequeDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  detailValue: {
    fontSize: 13,
  },
  statusHistory: {
    marginTop: 8,
  },
  statusDate: {
    fontSize: 11,
    opacity: 0.7,
  },
  updateButton: {
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
  dialogChequeInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  bouncedReasonContainer: {
    marginTop: 16,
  },
  reasonButton: {
    marginBottom: 12,
  },
  warningCard: {
    backgroundColor: '#FFEBEE',
  },
  warningText: {
    fontSize: 12,
    color: '#D32F2F',
  },
});
