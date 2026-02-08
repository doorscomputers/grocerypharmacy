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
import PaymentReceiptPreview, { PaymentReceiptData } from '../components/PaymentReceiptPreview';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { buildPaymentReceipt, PRINTER_WIDTH } from '../utils/escpos';

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
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

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

  // Receipt preview state
  const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const theme = useTheme();
  const { user } = useAuth();
  const printerService = BluetoothPrinterService.getInstance();

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

      const paymentResult = await dbService.processCustomerPayment({
        customer_id: selectedReceivable.customer_id,
        transaction_id: selectedReceivable.transaction_id,
        payment_method: paymentMethod,
        amount_paid: amount,
        reference_number: referenceNumber || undefined,
        notes: paymentNotes || undefined,
        received_by: user!.id
      });

      // Get business settings for receipt
      const companyName = await dbService.getSetting('company_name') || 'Your Company';
      const companyAddress = await dbService.getSetting('company_address') || '';
      const companyTin = await dbService.getSetting('company_tin') || '';
      const receiptFooter = await dbService.getSetting('receipt_footer') || '';

      // Prepare receipt data
      const previouslyPaid = selectedReceivable.paid_amount || 0;
      const balanceAfterPayment = selectedReceivable.balance_amount - amount;

      const newReceiptData: PaymentReceiptData = {
        businessName: companyName,
        businessAddress: companyAddress,
        tin: companyTin,
        paymentNumber: paymentResult?.payment_number || `PAY${Date.now()}`,
        paymentDate: new Date(),
        receivedBy: user?.username || 'Cashier',
        customerName: selectedReceivable.customer_name || 'Walk-in Customer',
        customerCode: selectedReceivable.customer_code,
        invoiceNumber: selectedReceivable.invoice_number,
        originalAmount: selectedReceivable.original_amount,
        previouslyPaid: previouslyPaid,
        amountPaid: amount,
        balanceAfterPayment: balanceAfterPayment,
        paymentMethod: paymentMethod,
        referenceNumber: referenceNumber || undefined,
        notes: paymentNotes || undefined,
        footerText: receiptFooter,
      };

      setReceiptData(newReceiptData);
      setPaymentModalVisible(false);
      setReceiptPreviewVisible(true);
      await loadData();
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptData) return;

    if (!printerService.isConnected()) {
      Alert.alert(
        'Printer Not Connected',
        'Would you like to connect to a printer?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Connect', onPress: () => navigation.navigate('PrinterSettings') }
        ]
      );
      return;
    }

    try {
      setIsPrinting(true);
      const printerWidth = printerService.getSettings().printerWidth;

      const receiptBuilder = buildPaymentReceipt({
        businessName: receiptData.businessName,
        businessAddress: receiptData.businessAddress,
        tin: receiptData.tin,
        paymentNumber: receiptData.paymentNumber,
        paymentDate: receiptData.paymentDate,
        receivedBy: receiptData.receivedBy,
        customerName: receiptData.customerName,
        customerCode: receiptData.customerCode,
        invoiceNumber: receiptData.invoiceNumber,
        originalAmount: receiptData.originalAmount,
        previouslyPaid: receiptData.previouslyPaid,
        amountPaid: receiptData.amountPaid,
        balanceAfterPayment: receiptData.balanceAfterPayment,
        paymentMethod: receiptData.paymentMethod,
        referenceNumber: receiptData.referenceNumber,
        notes: receiptData.notes,
        footerText: receiptData.footerText,
      }, printerWidth);

      await printerService.print(receiptBuilder.getBuffer());
      Alert.alert('Success', 'Receipt printed successfully');
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', 'Failed to print receipt. Please check printer connection.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendEmail = async (email: string) => {
    if (!receiptData) return;

    try {
      setIsSendingEmail(true);

      // For now, we'll just simulate sending email
      // In a real app, you would call an API endpoint to send the email
      // with the receipt data

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Log for debugging
      console.log('Sending payment receipt to:', email);
      console.log('Receipt data:', receiptData);

      // In a real implementation, you would:
      // const response = await fetch('your-api/send-receipt-email', {
      //   method: 'POST',
      //   body: JSON.stringify({ email, receiptData }),
      // });

    } catch (error) {
      console.error('Email error:', error);
      throw error;
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCloseReceipt = () => {
    setReceiptPreviewVisible(false);
    setReceiptData(null);
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
    // Status filter
    if (statusFilter === 'UNPAID') {
      if (receivable.status !== 'OUTSTANDING' && receivable.status !== 'OVERDUE' && receivable.status !== 'PARTIALLY_PAID') return false;
    } else if (statusFilter === 'PAID') {
      if (receivable.status !== 'PAID') return false;
    } else if (statusFilter) {
      if (receivable.status !== statusFilter) return false;
    }

    // Search filter
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
            {/* Status Filter */}
            <View style={styles.statusFilterContainer}>
              <Chip
                selected={statusFilter === null}
                onPress={() => setStatusFilter(null)}
                style={styles.statusChipFilter}
                compact
              >
                All
              </Chip>
              <Chip
                selected={statusFilter === 'UNPAID'}
                onPress={() => setStatusFilter('UNPAID')}
                style={styles.statusChipFilter}
                compact
              >
                Unpaid
              </Chip>
              <Chip
                selected={statusFilter === 'PAID'}
                onPress={() => setStatusFilter('PAID')}
                style={styles.statusChipFilter}
                compact
              >
                Paid
              </Chip>
              <Chip
                selected={statusFilter === 'OVERDUE'}
                onPress={() => setStatusFilter('OVERDUE')}
                style={styles.statusChipFilter}
                compact
              >
                Overdue
              </Chip>
            </View>
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

        {/* Customer Filter - Search as you type */}
        <View style={styles.filterContainer}>
          <Title style={styles.filterLabel}>Filter by Customer:</Title>
          <View style={styles.customerSearchContainer}>
            <TextInput
              mode="outlined"
              placeholder="Search customer by name or code..."
              value={selectedCustomer ? selectedCustomerName : customerSearchText}
              onChangeText={(text) => {
                if (selectedCustomer) {
                  // Clear selection when user starts typing again
                  setSelectedCustomer(null);
                  setSelectedCustomerName('');
                }
                setCustomerSearchText(text);
                setShowCustomerSuggestions(text.length > 0);
              }}
              onFocus={() => {
                if (customerSearchText.length > 0 && !selectedCustomer) {
                  setShowCustomerSuggestions(true);
                }
              }}
              style={styles.customerSearchInput}
              right={selectedCustomer ? (
                <TextInput.Icon
                  icon="close"
                  onPress={() => {
                    setSelectedCustomer(null);
                    setSelectedCustomerName('');
                    setCustomerSearchText('');
                    setShowCustomerSuggestions(false);
                  }}
                />
              ) : undefined}
            />
            {showCustomerSuggestions && !selectedCustomer && (
              <View style={styles.suggestionsContainer}>
                <ScrollView style={styles.suggestionsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  <Button
                    mode="text"
                    onPress={() => {
                      setSelectedCustomer(null);
                      setSelectedCustomerName('');
                      setCustomerSearchText('');
                      setShowCustomerSuggestions(false);
                      loadFilteredData();
                    }}
                    style={styles.suggestionItem}
                    labelStyle={styles.suggestionLabel}
                  >
                    All Customers
                  </Button>
                  {customers
                    .filter((c) => {
                      const searchLower = customerSearchText.toLowerCase();
                      return (
                        c.name?.toLowerCase().includes(searchLower) ||
                        c.code?.toLowerCase().includes(searchLower)
                      );
                    })
                    .slice(0, 20) // Limit to 20 suggestions for performance
                    .map((customer) => (
                      <Button
                        key={customer.id}
                        mode="text"
                        onPress={() => {
                          setSelectedCustomer(customer.id);
                          setSelectedCustomerName(`${customer.code} - ${customer.name}`);
                          setCustomerSearchText('');
                          setShowCustomerSuggestions(false);
                        }}
                        style={styles.suggestionItem}
                        labelStyle={styles.suggestionLabel}
                      >
                        {customer.code} - {customer.name}
                      </Button>
                    ))}
                  {customers.filter((c) => {
                    const searchLower = customerSearchText.toLowerCase();
                    return (
                      c.name?.toLowerCase().includes(searchLower) ||
                      c.code?.toLowerCase().includes(searchLower)
                    );
                  }).length === 0 && (
                    <Paragraph style={styles.noResultsText}>No customers found</Paragraph>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
          <Button
            mode="outlined"
            onPress={() => {
              setShowCustomerSuggestions(false);
              loadFilteredData();
            }}
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
          <ScrollView showsVerticalScrollIndicator={false}>
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
          </ScrollView>
        </Modal>
      </Portal>

      {/* Receipt Preview */}
      {receiptData && (
        <PaymentReceiptPreview
          data={receiptData}
          visible={receiptPreviewVisible}
          onClose={handleCloseReceipt}
          onPrint={handlePrintReceipt}
          onSendEmail={handleSendEmail}
          isPrinting={isPrinting}
          isSendingEmail={isSendingEmail}
        />
      )}
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
  customerSearchContainer: {
    position: 'relative',
    zIndex: 1000,
    marginBottom: 8,
  },
  customerSearchInput: {
    backgroundColor: 'white',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: 200,
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  suggestionLabel: {
    textAlign: 'left',
    fontSize: 14,
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
    opacity: 0.6,
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
  statusFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statusChipFilter: {
    marginRight: 4,
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
    paddingBottom: 8,
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