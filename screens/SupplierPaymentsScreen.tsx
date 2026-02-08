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
  TextInput,
  FAB,
  useTheme,
  Dialog,
  Portal,
  Chip,
  Menu,
  Divider,
  DataTable,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { Supplier } from '../database/schema';
import DateRangeFilter, { getDateRange } from '../components/DateRangeFilter';

type SupplierPaymentsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'SupplierPayments'
>;

type Props = {
  navigation: SupplierPaymentsScreenNavigationProp;
};

type PaymentMethod = 'CASH' | 'CHEQUE' | 'OTHERS';
type OthersType = 'GCASH' | 'MAYA' | 'BANK_TRANSFER' | 'PAYPAL' | 'OTHER';

export default function SupplierPaymentsScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'payments' | 'payables' | 'aging'>('payables');
  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<any[]>([]);
  const [agingReport, setAgingReport] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  // Date filter
  const [dateRange, setDateRange] = useState(() => {
    const range = getDateRange('this_month');
    return { startDate: range.startDate, endDate: range.endDate };
  });

  // Payment Dialog
  const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierMenuVisible, setSupplierMenuVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceMenuVisible, setInvoiceMenuVisible] = useState(false);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentMethodMenuVisible, setPaymentMethodMenuVisible] = useState(false);
  const [othersType, setOthersType] = useState<OthersType>('GCASH');
  const [othersTypeMenuVisible, setOthersTypeMenuVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  // Cheque fields
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [chequeDate, setChequeDate] = useState('');

  const theme = useTheme();

  useEffect(() => {
    loadData();
  }, []);

  // Filter payments when date range changes
  useEffect(() => {
    const filtered = payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return paymentDate >= dateRange.startDate && paymentDate <= dateRange.endDate;
    });
    setFilteredPayments(filtered);
  }, [payments, dateRange]);

  const handleDateChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dbService = getDatabase();

      const [paymentsData, payablesData, agingData, suppliersData] = await Promise.all([
        dbService.getSupplierPayments(undefined, 50),
        dbService.getAccountsPayable(),
        dbService.getAccountsPayableAging(),
        dbService.getSuppliers(true)
      ]);

      setPayments(paymentsData);
      setAccountsPayable(payablesData);
      setAgingReport(agingData);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OUTSTANDING': return '#2196F3';
      case 'PARTIALLY_PAID': return '#FF9800';
      case 'PAID': return '#4CAF50';
      case 'OVERDUE': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CASH': return '#4CAF50';
      case 'CHEQUE': return '#2196F3';
      case 'OTHERS': return '#9C27B0';
      default: return '#9E9E9E';
    }
  };

  const openPaymentDialog = () => {
    setSelectedSupplier(null);
    setSelectedInvoice(null);
    setSupplierInvoices([]);
    setPaymentMethod('CASH');
    setOthersType('GCASH');
    setPaymentAmount('');
    setReferenceNumber('');
    setPaymentNotes('');
    // Reset cheque fields
    setChequeNumber('');
    setBankName('');
    setPayeeName('');
    setChequeDate('');
    setPaymentDialogVisible(true);
  };

  const loadSupplierInvoices = async (supplierId: number) => {
    try {
      const dbService = getDatabase();
      // Get unpaid invoices for this supplier
      const invoices = await dbService.getAccountsPayable(supplierId);
      // Filter only unpaid invoices (balance > 0)
      const unpaidInvoices = invoices.filter((inv: any) => inv.balance_amount > 0);
      setSupplierInvoices(unpaidInvoices);
    } catch (error) {
      console.error('Error loading supplier invoices:', error);
      setSupplierInvoices([]);
    }
  };

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSelectedInvoice(null);
    setPaymentAmount('');
    setSupplierMenuVisible(false);
    loadSupplierInvoices(supplier.id);
  };

  const handleInvoiceSelect = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.balance_amount.toString());
    setInvoiceMenuVisible(false);
  };

  const createPayment = async () => {
    if (!selectedSupplier) {
      Alert.alert('Error', 'Please select a supplier');
      return;
    }

    if (!selectedInvoice) {
      Alert.alert('Error', 'Please select an invoice to pay');
      return;
    }

    // Validate cheque fields when CHEQUE is selected
    if (paymentMethod === 'CHEQUE') {
      if (!chequeNumber.trim()) {
        Alert.alert('Error', 'Please enter cheque number');
        return;
      }
      if (!bankName.trim()) {
        Alert.alert('Error', 'Please enter bank name');
        return;
      }
      if (!payeeName.trim()) {
        Alert.alert('Error', 'Please enter payee name');
        return;
      }
      if (!chequeDate.trim()) {
        Alert.alert('Error', 'Please enter cheque date');
        return;
      }
    }

    // Full payment only - no partial payments allowed
    const amount = selectedInvoice.balance_amount;

    try {
      setLoading(true);
      const dbService = getDatabase();

      const paymentData: any = {
        supplier_id: selectedSupplier.id,
        purchase_id: selectedInvoice.purchase_id,
        payment_method: paymentMethod,
        reference_number: referenceNumber || undefined,
        amount: amount,
        notes: paymentNotes || undefined,
        created_by: 1 // TODO: Get from user context
      };

      // Add OTHERS sub-type if applicable
      if (paymentMethod === 'OTHERS') {
        paymentData.others_type = othersType;
      }

      // Add cheque fields if applicable
      if (paymentMethod === 'CHEQUE') {
        paymentData.cheque_number = chequeNumber;
        paymentData.bank_name = bankName;
        paymentData.payee_name = payeeName;
        paymentData.cheque_date = chequeDate;
      }

      const result = await dbService.createSupplierPayment(paymentData);

      Alert.alert(
        'Success',
        `Payment ${result.paymentNumber} created successfully`,
        [
          {
            text: 'OK',
            onPress: () => {
              setPaymentDialogVisible(false);
              loadData();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating payment:', error);
      Alert.alert('Error', 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  const renderPayment = ({ item }: { item: any }) => (
    <Card style={styles.paymentCard}>
      <Card.Content>
        <View style={styles.paymentHeader}>
          <View style={styles.paymentInfo}>
            <Title style={styles.paymentNumber}>{item.payment_number}</Title>
            <Paragraph style={styles.supplierName}>{item.supplier_name}</Paragraph>
            <Paragraph style={styles.paymentDate}>
              {new Date(item.payment_date).toLocaleDateString()}
            </Paragraph>
          </View>
          <View style={styles.paymentDetails}>
            <Chip
              style={[styles.methodChip, { backgroundColor: getPaymentMethodColor(item.payment_method) }]}
              textStyle={{ color: 'white' }}
            >
              {item.payment_method}
            </Chip>
            <Paragraph style={styles.paymentAmount}>
              ₱{item.amount.toLocaleString()}
            </Paragraph>
          </View>
        </View>

        {item.reference_number && (
          <Paragraph style={styles.reference}>Ref: {item.reference_number}</Paragraph>
        )}

        {item.purchase_number && (
          <Paragraph style={styles.reference}>PO: {item.purchase_number}</Paragraph>
        )}

        {item.notes && (
          <Paragraph style={styles.notes}>{item.notes}</Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  const renderPayable = ({ item }: { item: any }) => (
    <Card style={styles.payableCard}>
      <Card.Content>
        <View style={styles.payableHeader}>
          <View style={styles.payableInfo}>
            <Title style={styles.purchaseNumber}>{item.purchase_number}</Title>
            <Paragraph style={styles.supplierName}>{item.supplier_name}</Paragraph>
            <Paragraph style={styles.dueDate}>
              Due: {new Date(item.due_date).toLocaleDateString()}
            </Paragraph>
          </View>
          <View style={styles.payableDetails}>
            <Chip
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.current_status || item.status) }]}
              textStyle={{ color: 'white' }}
            >
              {item.current_status || item.status}
            </Chip>
            <Paragraph style={styles.balanceAmount}>
              ₱{item.balance_amount.toLocaleString()}
            </Paragraph>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.payableAmounts}>
          <View style={styles.amountRow}>
            <Paragraph style={styles.amountLabel}>Original:</Paragraph>
            <Paragraph style={styles.amountValue}>
              ₱{item.original_amount.toLocaleString()}
            </Paragraph>
          </View>
          <View style={styles.amountRow}>
            <Paragraph style={styles.amountLabel}>Paid:</Paragraph>
            <Paragraph style={styles.amountValue}>
              ₱{item.paid_amount.toLocaleString()}
            </Paragraph>
          </View>
          <View style={styles.amountRow}>
            <Paragraph style={styles.amountLabel}>Balance:</Paragraph>
            <Paragraph style={[styles.amountValue, { fontWeight: 'bold', color: '#F44336' }]}>
              ₱{item.balance_amount.toLocaleString()}
            </Paragraph>
          </View>
        </View>

        {item.days_past_due > 0 && (
          <Paragraph style={styles.pastDue}>
            {item.days_past_due} days overdue
          </Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  const renderAgingReport = () => (
    <Card style={styles.agingCard}>
      <Card.Content>
        <Title style={styles.agingTitle}>Accounts Payable Aging</Title>

        <View style={styles.agingSummary}>
          <View style={styles.summaryItem}>
            <Paragraph style={styles.summaryLabel}>Total Outstanding:</Paragraph>
            <Paragraph style={styles.summaryValue}>
              ₱{agingReport?.total_outstanding?.toLocaleString() || '0'}
            </Paragraph>
          </View>
          <View style={styles.summaryItem}>
            <Paragraph style={styles.summaryLabel}>Total Invoices:</Paragraph>
            <Paragraph style={styles.summaryValue}>
              {agingReport?.total_invoices || 0}
            </Paragraph>
          </View>
        </View>

        <Divider style={styles.divider} />

        <DataTable>
          <DataTable.Header>
            <DataTable.Title>Age Range</DataTable.Title>
            <DataTable.Title numeric>Count</DataTable.Title>
            <DataTable.Title numeric>Amount</DataTable.Title>
          </DataTable.Header>

          <DataTable.Row>
            <DataTable.Cell>0-30 days</DataTable.Cell>
            <DataTable.Cell numeric>{agingReport?.count_0_30 || 0}</DataTable.Cell>
            <DataTable.Cell numeric>₱{agingReport?.current_0_30?.toLocaleString() || '0'}</DataTable.Cell>
          </DataTable.Row>

          <DataTable.Row>
            <DataTable.Cell>31-60 days</DataTable.Cell>
            <DataTable.Cell numeric>{agingReport?.count_31_60 || 0}</DataTable.Cell>
            <DataTable.Cell numeric>₱{agingReport?.aged_31_60?.toLocaleString() || '0'}</DataTable.Cell>
          </DataTable.Row>

          <DataTable.Row>
            <DataTable.Cell>61-90 days</DataTable.Cell>
            <DataTable.Cell numeric>{agingReport?.count_61_90 || 0}</DataTable.Cell>
            <DataTable.Cell numeric>₱{agingReport?.aged_61_90?.toLocaleString() || '0'}</DataTable.Cell>
          </DataTable.Row>

          <DataTable.Row>
            <DataTable.Cell>90+ days</DataTable.Cell>
            <DataTable.Cell numeric>{agingReport?.count_over_90 || 0}</DataTable.Cell>
            <DataTable.Cell numeric>₱{agingReport?.aged_over_90?.toLocaleString() || '0'}</DataTable.Cell>
          </DataTable.Row>
        </DataTable>
      </Card.Content>
    </Card>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'payments':
        return (
          <View style={{ flex: 1 }}>
            {/* Date Filter */}
            <Card style={styles.dateFilterCard}>
              <Card.Content>
                <DateRangeFilter
                  onDateChange={handleDateChange}
                  selectedPreset="this_month"
                />
              </Card.Content>
            </Card>
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
      case 'payables':
        return (
          <FlatList
            data={accountsPayable}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPayable}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadData}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Paragraph style={styles.emptyText}>
                  No outstanding payables found.
                </Paragraph>
              </View>
            }
          />
        );
      case 'aging':
        return (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {renderAgingReport()}
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Supplier Payments</Title>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Button
            mode={activeTab === 'payments' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('payments')}
            style={styles.tabButton}
            compact
          >
            Payments
          </Button>
          <Button
            mode={activeTab === 'payables' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('payables')}
            style={styles.tabButton}
            compact
          >
            Payables
          </Button>
          <Button
            mode={activeTab === 'aging' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('aging')}
            style={styles.tabButton}
            compact
          >
            Aging
          </Button>
        </View>
      </View>

      {renderTabContent()}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={openPaymentDialog}
        label="New Payment"
        color="#FFFFFF"
      />

      {/* Create Payment Dialog */}
      <Portal>
        <Dialog visible={paymentDialogVisible} onDismiss={() => setPaymentDialogVisible(false)}>
          <Dialog.Title>Create Payment</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {/* Supplier Selection */}
              <Menu
                visible={supplierMenuVisible}
                onDismiss={() => setSupplierMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setSupplierMenuVisible(true)}
                    style={styles.dialogInput}
                    icon="chevron-down"
                    contentStyle={{ justifyContent: 'flex-start' }}
                  >
                    {selectedSupplier ? selectedSupplier.name : 'Select Supplier *'}
                  </Button>
                }
                contentStyle={{ backgroundColor: '#ffffff', maxHeight: 300 }}
                style={{ backgroundColor: '#ffffff' }}
              >
                {suppliers.map(supplier => (
                  <Menu.Item
                    key={supplier.id}
                    onPress={() => handleSupplierSelect(supplier)}
                    title={supplier.name}
                    style={{ backgroundColor: '#ffffff' }}
                    titleStyle={{ color: '#333333' }}
                  />
                ))}
              </Menu>

              {/* Invoice Selection */}
              {selectedSupplier && (
                <Menu
                  visible={invoiceMenuVisible}
                  onDismiss={() => setInvoiceMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setInvoiceMenuVisible(true)}
                      style={styles.dialogInput}
                      icon="chevron-down"
                      contentStyle={{ justifyContent: 'flex-start' }}
                    >
                      {selectedInvoice
                        ? `${selectedInvoice.purchase_number} - ₱${selectedInvoice.balance_amount.toLocaleString()}`
                        : 'Select Invoice to Pay *'}
                    </Button>
                  }
                  contentStyle={{ backgroundColor: '#ffffff', maxHeight: 300 }}
                  style={{ backgroundColor: '#ffffff' }}
                >
                  {supplierInvoices.length === 0 ? (
                    <Menu.Item
                      title="No unpaid invoices"
                      disabled
                      style={{ backgroundColor: '#ffffff' }}
                      titleStyle={{ color: '#999999' }}
                    />
                  ) : (
                    supplierInvoices.map(invoice => (
                      <Menu.Item
                        key={invoice.id}
                        onPress={() => handleInvoiceSelect(invoice)}
                        title={`${invoice.purchase_number} - Balance: ₱${invoice.balance_amount.toLocaleString()}`}
                        description={`Due: ${new Date(invoice.due_date).toLocaleDateString()}`}
                        style={{ backgroundColor: '#ffffff' }}
                        titleStyle={{ color: '#333333' }}
                      />
                    ))
                  )}
                </Menu>
              )}

              {/* Selected Invoice Details */}
              {selectedInvoice && (
                <Card style={styles.invoiceDetailCard}>
                  <Card.Content>
                    <Title style={styles.invoiceDetailTitle}>{selectedInvoice.purchase_number}</Title>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={styles.invoiceDetailRow}>
                      <Paragraph style={styles.invoiceDetailLabel}>Original Amount:</Paragraph>
                      <Paragraph style={styles.invoiceDetailValue}>₱{selectedInvoice.original_amount.toLocaleString()}</Paragraph>
                    </View>
                    <View style={styles.invoiceDetailRow}>
                      <Paragraph style={styles.invoiceDetailLabel}>Already Paid:</Paragraph>
                      <Paragraph style={styles.invoiceDetailValue}>₱{selectedInvoice.paid_amount.toLocaleString()}</Paragraph>
                    </View>
                    <View style={styles.invoiceDetailRow}>
                      <Paragraph style={[styles.invoiceDetailLabel, { fontWeight: 'bold' }]}>Balance Due:</Paragraph>
                      <Paragraph style={[styles.invoiceDetailValue, { fontWeight: 'bold', color: '#F44336' }]}>₱{selectedInvoice.balance_amount.toLocaleString()}</Paragraph>
                    </View>
                  </Card.Content>
                </Card>
              )}

              {/* Payment Method Selection */}
              {/* Payment Method Selection */}
              <Menu
                visible={paymentMethodMenuVisible}
                onDismiss={() => setPaymentMethodMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setPaymentMethodMenuVisible(true)}
                    style={styles.dialogInput}
                    icon="chevron-down"
                    contentStyle={{ justifyContent: 'flex-start' }}
                  >
                    Payment Method: {paymentMethod}
                  </Button>
                }
                contentStyle={{ backgroundColor: '#ffffff', maxHeight: 300 }}
                style={{ backgroundColor: '#ffffff' }}
              >
                {(['CASH', 'CHEQUE', 'OTHERS'] as PaymentMethod[]).map(method => (
                  <Menu.Item
                    key={method}
                    onPress={() => {
                      setPaymentMethod(method);
                      setPaymentMethodMenuVisible(false);
                    }}
                    title={method}
                    style={{ backgroundColor: '#ffffff' }}
                    titleStyle={{ color: '#333333' }}
                  />
                ))}
              </Menu>

              {/* OTHERS Sub-type Selection */}
              {paymentMethod === 'OTHERS' && (
                <Menu
                  visible={othersTypeMenuVisible}
                  onDismiss={() => setOthersTypeMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setOthersTypeMenuVisible(true)}
                      style={styles.dialogInput}
                      icon="chevron-down"
                      contentStyle={{ justifyContent: 'flex-start' }}
                    >
                      Type: {othersType}
                    </Button>
                  }
                  contentStyle={{ backgroundColor: '#ffffff', maxHeight: 300 }}
                  style={{ backgroundColor: '#ffffff' }}
                >
                  {(['GCASH', 'MAYA', 'BANK_TRANSFER', 'PAYPAL', 'OTHER'] as OthersType[]).map(type => (
                    <Menu.Item
                      key={type}
                      onPress={() => {
                        setOthersType(type);
                        setOthersTypeMenuVisible(false);
                      }}
                      title={type.replace('_', ' ')}
                      style={{ backgroundColor: '#ffffff' }}
                      titleStyle={{ color: '#333333' }}
                    />
                  ))}
                </Menu>
              )}

              {/* Cheque Fields (only show when CHEQUE is selected) */}
              {paymentMethod === 'CHEQUE' && (
                <Card style={styles.chequeFieldsCard}>
                  <Card.Content>
                    <Title style={styles.chequeFieldsTitle}>Cheque Details</Title>
                    <TextInput
                      label="Cheque Number *"
                      value={chequeNumber}
                      onChangeText={setChequeNumber}
                      mode="outlined"
                      style={styles.dialogInput}
                    />
                    <TextInput
                      label="Bank Name *"
                      value={bankName}
                      onChangeText={setBankName}
                      mode="outlined"
                      style={styles.dialogInput}
                    />
                    <TextInput
                      label="Payee Name *"
                      value={payeeName}
                      onChangeText={setPayeeName}
                      mode="outlined"
                      style={styles.dialogInput}
                      placeholder="Who the cheque is payable to"
                    />
                    <TextInput
                      label="Cheque Date (YYYY-MM-DD) *"
                      value={chequeDate}
                      onChangeText={setChequeDate}
                      mode="outlined"
                      style={styles.dialogInput}
                      placeholder="For PDC, enter future date"
                    />
                    <Paragraph style={styles.chequeNote}>
                      Post-dated cheques will be tracked in the PDC screen
                    </Paragraph>
                  </Card.Content>
                </Card>
              )}

              {/* Payment Amount - Read-only, full balance only */}
              {selectedInvoice && (
                <Card style={styles.paymentAmountCard}>
                  <Card.Content>
                    <View style={styles.paymentAmountRow}>
                      <Paragraph style={styles.paymentAmountLabel}>Payment Amount:</Paragraph>
                      <Paragraph style={styles.paymentAmountValue}>
                        ₱{selectedInvoice.balance_amount.toLocaleString()}
                      </Paragraph>
                    </View>
                    <Paragraph style={styles.fullPaymentNote}>
                      Full balance payment only. Partial payments are not allowed.
                    </Paragraph>
                  </Card.Content>
                </Card>
              )}

              <TextInput
                label="Reference Number"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                mode="outlined"
                style={styles.dialogInput}
                placeholder="Transaction reference, etc."
              />

              <TextInput
                label="Notes"
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                mode="outlined"
                style={styles.dialogInput}
                multiline
                numberOfLines={3}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setPaymentDialogVisible(false)}>Cancel</Button>
            <Button onPress={createPayment} loading={loading}>
              Create Payment
            </Button>
          </Dialog.Actions>
        </Dialog>
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
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  paymentCard: {
    marginBottom: 16,
    elevation: 4,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  supplierName: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  paymentDetails: {
    alignItems: 'flex-end',
  },
  methodChip: {
    marginBottom: 8,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  reference: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  payableCard: {
    marginBottom: 16,
    elevation: 4,
  },
  payableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  payableInfo: {
    flex: 1,
  },
  purchaseNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dueDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  payableDetails: {
    alignItems: 'flex-end',
  },
  statusChip: {
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  divider: {
    marginVertical: 12,
  },
  payableAmounts: {
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  amountValue: {
    fontSize: 12,
  },
  pastDue: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  agingCard: {
    elevation: 4,
  },
  agingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  agingSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 70,
  },
  dialogContent: {
    maxHeight: 450,
  },
  dialogInput: {
    marginBottom: 16,
  },
  invoiceDetailCard: {
    marginBottom: 16,
    backgroundColor: '#E3F2FD',
  },
  invoiceDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
  },
  invoiceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  invoiceDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  invoiceDetailValue: {
    fontSize: 14,
    color: '#333',
  },
  dateFilterCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  chequeFieldsCard: {
    marginBottom: 16,
    backgroundColor: '#E8F5E9',
  },
  chequeFieldsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12,
  },
  chequeNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  paymentAmountCard: {
    marginBottom: 16,
    backgroundColor: '#FFF3E0',
  },
  paymentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentAmountLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
  },
  paymentAmountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E65100',
  },
  fullPaymentNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
});