import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  useTheme,
  Chip,
  DataTable,
  Searchbar,
  Modal,
  Portal,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import { Picker } from '@react-native-picker/picker';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type CustomerPaymentsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CustomerPayments'
>;

type Props = {
  navigation: CustomerPaymentsScreenNavigationProp;
};

export default function CustomerPaymentsScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'receivables' | 'payments'>('receivables');
  const [receivables, setReceivables] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  // Date filter
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  // Payment modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' | 'ONLINE'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const theme = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  // Filter payments when date range or search query changes
  useEffect(() => {
    let filtered = payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return paymentDate >= dateRange.startDate && paymentDate <= dateRange.endDate;
    });

    // Also apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.customer_name?.toLowerCase().includes(query) ||
        payment.payment_number?.toLowerCase().includes(query) ||
        payment.invoice_number?.toLowerCase().includes(query)
      );
    }

    setFilteredPayments(filtered);
  }, [payments, dateRange, searchQuery]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const [receivablesData, paymentsData, customersData] = await Promise.all([
        dbService.getAccountsReceivable(),
        dbService.getCustomerPayments(),
        dbService.getCustomers()
      ]);

      setReceivables(receivablesData);
      setPayments(paymentsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customer payments data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const [receivablesData, paymentsData] = await Promise.all([
        dbService.getAccountsReceivable(selectedCustomer || undefined),
        dbService.getCustomerPayments(selectedCustomer || undefined)
      ]);

      setReceivables(receivablesData);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error loading filtered data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = (receivable: any) => {
    setSelectedReceivable(receivable);
    setPaymentAmount(receivable.balance_amount.toString());
    setPaymentMethod('CASH');
    setReferenceNumber('');
    setPaymentNotes('');
    setPaymentModalVisible(true);
  };

  const processPayment = async () => {
    if (!selectedReceivable || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > selectedReceivable.balance_amount) {
      Alert.alert('Error', 'Payment amount cannot exceed the outstanding balance');
      return;
    }

    try {
      setLoading(true);
      const dbService = getDatabase();

      await dbService.processCustomerPayment({
        customer_id: selectedReceivable.customer_id,
        transaction_id: selectedReceivable.transaction_id,
        payment_method: paymentMethod,
        amount_paid: amount,
        reference_number: referenceNumber || undefined,
        notes: paymentNotes || undefined,
        received_by: user!.id
      });

      Alert.alert('Success', 'Payment processed successfully');
      setPaymentModalVisible(false);
      await loadData();
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OUTSTANDING': return '#F44336';
      case 'PARTIALLY_PAID': return '#FF9800';
      case 'PAID': return '#4CAF50';
      case 'OVERDUE': return '#D32F2F';
      default: return '#9E9E9E';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CARD': return '#2196F3';
      case 'CHECK': return '#FF9800';
      case 'BANK_TRANSFER': return '#9C27B0';
      case 'ONLINE': return '#607D8B';
      default: return '#9E9E9E';
    }
  };

  const filteredReceivables = receivables.filter(receivable => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      receivable.customer_name?.toLowerCase().includes(query) ||
      receivable.invoice_number?.toLowerCase().includes(query) ||
      receivable.customer_code?.toLowerCase().includes(query)
    );
  });

  const renderReceivable = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.receivableInfo}>
            <Paragraph style={styles.customerName}>{item.customer_name || 'Walk-in Customer'}</Paragraph>
            <Paragraph style={styles.customerCode}>{item.customer_code}</Paragraph>
            <Paragraph style={styles.invoiceNumber}>Invoice: {item.invoice_number}</Paragraph>
            <Paragraph style={styles.dates}>
              Due: {new Date(item.due_date).toLocaleDateString()}
            </Paragraph>
            <Paragraph style={styles.dates}>
              Issued: {new Date(item.invoice_date).toLocaleDateString()}
            </Paragraph>
          </View>
          <View style={styles.receivableStats}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
              textStyle={{ color: 'white', fontSize: 10 }}
              compact
            >
              {item.status}
            </Chip>
            <Paragraph style={styles.originalAmount}>
              ₱{item.original_amount?.toFixed(2)}
            </Paragraph>
            <Paragraph style={styles.paidAmount}>
              Paid: ₱{item.paid_amount?.toFixed(2)}
            </Paragraph>
            <Paragraph style={[styles.balanceAmount, { color: getStatusColor(item.status) }]}>
              Balance: ₱{item.balance_amount?.toFixed(2)}
            </Paragraph>
          </View>
        </View>

        {item.status !== 'PAID' && (
          <Button
            mode="contained"
            onPress={() => handlePayment(item)}
            style={styles.payButton}
            compact
          >
            Collect Payment
          </Button>
        )}
      </Card.Content>
    </Card>
  );

  const renderPayment = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.paymentInfo}>
            <Paragraph style={styles.paymentNumber}>Payment: {item.payment_number}</Paragraph>
            <Paragraph style={styles.customerName}>{item.customer_name || 'Walk-in Customer'}</Paragraph>
            <Paragraph style={styles.invoiceNumber}>Invoice: {item.invoice_number}</Paragraph>
            <Paragraph style={styles.dates}>
              Paid: {new Date(item.payment_date).toLocaleDateString()}
            </Paragraph>
            <Paragraph style={styles.receivedBy}>By: {item.received_by_name}</Paragraph>
          </View>
          <View style={styles.paymentStats}>
            <Chip
              style={[styles.methodChip, { backgroundColor: getPaymentMethodColor(item.payment_method) }]}
              textStyle={{ color: 'white', fontSize: 10 }}
              compact
            >
              {item.payment_method}
            </Chip>
            <Paragraph style={styles.paymentAmount}>
              ₱{item.amount_paid?.toFixed(2)}
            </Paragraph>
          </View>
        </View>

        {item.reference_number && (
          <Paragraph style={styles.referenceNumber}>
            Ref: {item.reference_number}
          </Paragraph>
        )}

        {item.notes && (
          <Paragraph style={styles.notes}>{item.notes}</Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'receivables':
        return (
          <View style={styles.tabContent}>
            <Searchbar
              placeholder="Search receivables..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />
            <FlatList
              data={filteredReceivables}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderReceivable}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={loadData}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Paragraph style={styles.emptyText}>
                    No outstanding receivables found.
                  </Paragraph>
                </View>
              }
            />
          </View>
        );
      case 'payments':
        return (
          <View style={styles.tabContent}>
            {/* Date Filter */}
            <Card style={styles.dateFilterCard}>
              <Card.Content>
                <DateRangeFilter
                  onDateChange={handleDateChange}
                  selectedPreset="this_month"
                />
              </Card.Content>
            </Card>
            <Searchbar
              placeholder="Search payments..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />
            <FlatList
              data={filteredPayments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderPayment}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={loadData}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Paragraph style={styles.emptyText}>
                    No payments found for the selected date range.
                  </Paragraph>
                </View>
              }
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Customer Payments</Title>

        {/* Customer Filter */}
        <View style={styles.filterContainer}>
          <Title style={styles.filterLabel}>Filter by Customer:</Title>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCustomer}
              onValueChange={(value) => setSelectedCustomer(value)}
              style={styles.picker}
            >
              <Picker.Item label="All Customers" value={null} />
              {customers.map((customer) => (
                <Picker.Item
                  key={customer.id}
                  label={`${customer.code} - ${customer.name}`}
                  value={customer.id}
                />
              ))}
            </Picker>
          </View>
          <Button
            mode="outlined"
            onPress={loadFilteredData}
            style={styles.filterButton}
            compact
          >
            Apply
          </Button>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Button
            mode={activeTab === 'receivables' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('receivables')}
            style={styles.tabButton}
            compact
          >
            Outstanding
          </Button>
          <Button
            mode={activeTab === 'payments' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('payments')}
            style={styles.tabButton}
            compact
          >
            Payments
          </Button>
        </View>
      </View>

      {renderTabContent()}

      {/* Payment Modal */}
      <Portal>
        <Modal
          visible={paymentModalVisible}
          onDismiss={() => setPaymentModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Title style={styles.modalTitle}>Collect Payment</Title>

          {selectedReceivable && (
            <View style={styles.modalContent}>
              <Paragraph style={styles.modalLabel}>Customer: {selectedReceivable.customer_name}</Paragraph>
              <Paragraph style={styles.modalLabel}>Invoice: {selectedReceivable.invoice_number}</Paragraph>
              <Paragraph style={styles.modalLabel}>
                Outstanding Balance: ₱{selectedReceivable.balance_amount?.toFixed(2)}
              </Paragraph>

              <Divider style={styles.divider} />

              <TextInput
                label="Payment Amount"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />

              <Title style={styles.inputLabel}>Payment Method:</Title>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={paymentMethod}
                  onValueChange={setPaymentMethod}
                  style={styles.picker}
                >
                  <Picker.Item label="Cash" value="CASH" />
                  <Picker.Item label="Card" value="CARD" />
                  <Picker.Item label="Check" value="CHECK" />
                  <Picker.Item label="Bank Transfer" value="BANK_TRANSFER" />
                  <Picker.Item label="Online Payment" value="ONLINE" />
                </Picker>
              </View>

              <TextInput
                label="Reference Number (Optional)"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                mode="outlined"
                style={styles.input}
                placeholder="Check #, Bank ref, etc."
              />

              <TextInput
                label="Notes (Optional)"
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.input}
              />

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setPaymentModalVisible(false)}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={processPayment}
                  style={styles.modalButton}
                  loading={loading}
                >
                  Process Payment
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </SafeAreaView>
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
    marginBottom: 16,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 8,
  },
  picker: {
    height: 50,
  },
  filterButton: {
    alignSelf: 'flex-start',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  dateFilterCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  searchBar: {
    margin: 16,
    marginTop: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    marginBottom: 16,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  receivableInfo: {
    flex: 1,
  },
  paymentInfo: {
    flex: 1,
  },
  receivableStats: {
    alignItems: 'flex-end',
  },
  paymentStats: {
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  customerCode: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  paymentNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#2196F3',
  },
  dates: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  receivedBy: {
    fontSize: 12,
    opacity: 0.7,
  },
  statusChip: {
    marginBottom: 8,
    alignSelf: 'flex-end',
  },
  methodChip: {
    marginBottom: 8,
    alignSelf: 'flex-end',
  },
  originalAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  paidAmount: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  referenceNumber: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    opacity: 0.8,
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.7,
  },
  payButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
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
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  input: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  modalButton: {
    flex: 1,
  },
});