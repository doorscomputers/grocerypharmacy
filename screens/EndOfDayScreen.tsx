import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  useTheme,
  Divider,
  DataTable,
  Chip,
  List,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'EndOfDay'>;
};

interface CashDenomination {
  value: number;
  label: string;
  count: number;
}

interface DaySummary {
  grossSales: number;
  discounts: number;
  salesReturns: number;
  netSales: number;
  // Sales by payment method
  cashSales: number;
  creditSales: number;
  gcashSales: number;
  cardSales: number;
  checkSales: number;
  otherSales: number;
  voidAmount: number;
  voidCount: number;
  transactionCount: number;
  // Customer payments by method (AR collections)
  customerPaymentsCash: number;
  customerPaymentsCheck: number;
  customerPaymentsCard: number;
  customerPaymentsOnline: number;
  customerPaymentsBankTransfer: number;
  customerPaymentsTotal: number;
  // Supplier payments by method
  supplierPaymentsCash: number;
  supplierPaymentsCheck: number;
  supplierPaymentsBankTransfer: number;
  supplierPaymentsTotal: number;
  // Cash refunds
  salesReturnsCash: number;
  // Cash movements (from cash_movements table)
  cashFundAdded: number;      // OPENING_FUND + CASH_IN
  pettyCashWithdrawn: number; // PETTY_CASH
  cashRefunds: number;        // CASH_REFUND (from exchanges, etc.)
}

export default function EndOfDayScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user } = useAuth();

  // Beginning cash (from previous day or manual input)
  const [beginningCash, setBeginningCash] = useState<string>('0');

  // Cash denominations - Philippine currency
  const [denominations, setDenominations] = useState<CashDenomination[]>([
    { value: 1000, label: '₱1,000', count: 0 },
    { value: 500, label: '₱500', count: 0 },
    { value: 200, label: '₱200', count: 0 },
    { value: 100, label: '₱100', count: 0 },
    { value: 50, label: '₱50', count: 0 },
    { value: 20, label: '₱20', count: 0 },
    { value: 10, label: '₱10', count: 0 },
    { value: 5, label: '₱5', count: 0 },
    { value: 1, label: '₱1', count: 0 },
    { value: 0.25, label: '25¢', count: 0 },
  ]);

  // Day summary
  const [daySummary, setDaySummary] = useState<DaySummary>({
    grossSales: 0,
    discounts: 0,
    salesReturns: 0,
    netSales: 0,
    cashSales: 0,
    creditSales: 0,
    gcashSales: 0,
    cardSales: 0,
    checkSales: 0,
    otherSales: 0,
    voidAmount: 0,
    voidCount: 0,
    transactionCount: 0,
    customerPaymentsCash: 0,
    customerPaymentsCheck: 0,
    customerPaymentsCard: 0,
    customerPaymentsOnline: 0,
    customerPaymentsBankTransfer: 0,
    customerPaymentsTotal: 0,
    supplierPaymentsCash: 0,
    supplierPaymentsCheck: 0,
    supplierPaymentsBankTransfer: 0,
    supplierPaymentsTotal: 0,
    salesReturnsCash: 0,
    cashFundAdded: 0,
    pettyCashWithdrawn: 0,
    cashRefunds: 0,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eodHistory, setEodHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentShift, setCurrentShift] = useState<{ id: number; start_time: string } | null>(null);

  useEffect(() => {
    loadDayData();
  }, []);

  const loadDayData = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();

      // Get current shift for this user
      let shiftStartTime: string | undefined;
      if (user?.id) {
        const shift = await dbService.getCurrentShift(user.id);
        if (shift) {
          setCurrentShift({ id: shift.id, start_time: shift.start_time });
          shiftStartTime = shift.start_time;
        }
      }

      // Get transactions - filter by shift if exists, otherwise by today
      let todayTransactions;
      if (shiftStartTime) {
        // Get transactions from shift start time onwards
        todayTransactions = await dbService.getTransactionsSinceTime(shiftStartTime);
      } else {
        todayTransactions = await dbService.getTodaysTransactions();
      }

      // Get sales returns - filter by shift if exists
      const allReturns = await dbService.getSalesReturns();
      const today = new Date().toISOString().split('T')[0];
      const todayReturns = shiftStartTime
        ? allReturns.filter((r: any) => r.created_at >= shiftStartTime)
        : allReturns.filter((r: any) => r.created_at?.startsWith(today));

      // Get customer payments - filter by shift if exists
      const allCustomerPayments = await dbService.getCustomerPayments();
      const todayCustomerPayments = shiftStartTime
        ? allCustomerPayments.filter((p: any) => p.created_at >= shiftStartTime)
        : allCustomerPayments.filter((p: any) => p.created_at?.startsWith(today));

      // Get supplier payments - filter by shift if exists
      const allSupplierPayments = await dbService.getSupplierPayments();
      const todaySupplierPayments = shiftStartTime
        ? allSupplierPayments.filter((p: any) => p.created_at >= shiftStartTime)
        : allSupplierPayments.filter((p: any) => p.created_at?.startsWith(today));

      // Get cash movements - filter by shift if exists
      const allCashMovements = await dbService.getCashMovements(today);
      const todayCashMovements = shiftStartTime
        ? (allCashMovements || []).filter((m: any) => m.created_at >= shiftStartTime)
        : allCashMovements;

      // Get EOD history
      const eodRecords = await dbService.getEndOfDayRecords();
      setEodHistory(eodRecords || []);

      // Get beginning cash - use shift's beginning_cash if active shift exists
      if (user?.id) {
        const shift = await dbService.getCurrentShift(user.id);
        if (shift?.beginning_cash !== undefined) {
          setBeginningCash(String(shift.beginning_cash));
        } else {
          // Fall back to last EOD or settings
          const lastEod = eodRecords?.[0];
          if (lastEod?.next_day_beginning_cash) {
            setBeginningCash(String(lastEod.next_day_beginning_cash));
          } else {
            const savedBeginningCash = await dbService.getSetting('beginning_cash');
            if (savedBeginningCash) {
              setBeginningCash(savedBeginningCash);
            }
          }
        }
      }

      // Calculate summary
      const completedTransactions = todayTransactions.filter((t: any) => t.status === 'COMPLETED');
      const voidedTransactions = todayTransactions.filter((t: any) => t.status === 'VOID');

      // Gross Sales = total_amount + discount_amount (what was sold BEFORE discounts)
      // This handles old transactions where subtotal might be NULL
      const grossSales = completedTransactions.reduce((sum: number, t: any) => {
        const total = t.total_amount || 0;
        const discount = t.discount_amount || 0;
        return sum + total + discount;  // Gross = Net + Discount
      }, 0);
      const discounts = completedTransactions.reduce((sum: number, t: any) => sum + (t.discount_amount || 0), 0);

      // Sales returns - only cash refunds affect cash drawer
      const salesReturnsCash = todayReturns
        .filter((r: any) => r.refund_method === 'CASH')
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      const salesReturnsTotal = todayReturns
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);

      // Sales by payment method
      const cashSales = completedTransactions
        .filter((t: any) => t.payment_method === 'CASH')
        .reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

      const creditSales = completedTransactions
        .filter((t: any) => t.payment_method === 'CHARGE_INVOICE')
        .reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

      const gcashSales = completedTransactions
        .filter((t: any) => t.payment_method === 'ONLINE')
        .reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

      const cardSales = completedTransactions
        .filter((t: any) => t.payment_method === 'CARD')
        .reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

      const checkSales = completedTransactions
        .filter((t: any) => t.payment_method === 'CHECK')
        .reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

      const otherSales = grossSales - cashSales - creditSales - gcashSales - cardSales - checkSales;

      // Customer payments (AR collections) by method
      const customerPaymentsCash = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'CASH')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const customerPaymentsCheck = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'CHECK')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const customerPaymentsCard = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'CARD' || p.payment_method === 'CREDIT_CARD')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const customerPaymentsOnline = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'ONLINE' || p.payment_method === 'GCASH')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const customerPaymentsBankTransfer = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'BANK_TRANSFER')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const customerPaymentsTotal = todayCustomerPayments
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      // Supplier payments by method
      const supplierPaymentsCash = todaySupplierPayments
        .filter((p: any) => p.payment_method === 'CASH')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const supplierPaymentsCheck = todaySupplierPayments
        .filter((p: any) => p.payment_method === 'CHECK')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const supplierPaymentsBankTransfer = todaySupplierPayments
        .filter((p: any) => p.payment_method === 'BANK_TRANSFER')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const supplierPaymentsTotal = todaySupplierPayments
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      // Cash movements - affects physical cash in drawer
      const cashFundAdded = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'OPENING_FUND' || m.movement_type === 'CASH_IN')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
      const pettyCashWithdrawn = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'PETTY_CASH' || m.movement_type === 'CASH_OUT')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
      const cashRefunds = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'CASH_REFUND')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

      setDaySummary({
        grossSales,
        discounts,
        salesReturns: salesReturnsTotal,
        netSales: grossSales - discounts,
        cashSales,
        creditSales,
        gcashSales,
        cardSales,
        checkSales,
        otherSales,
        voidAmount: voidedTransactions.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0),
        voidCount: voidedTransactions.length,
        transactionCount: completedTransactions.length,
        customerPaymentsCash,
        customerPaymentsCheck,
        customerPaymentsCard,
        customerPaymentsOnline,
        customerPaymentsBankTransfer,
        customerPaymentsTotal,
        supplierPaymentsCash,
        supplierPaymentsCheck,
        supplierPaymentsBankTransfer,
        supplierPaymentsTotal,
        salesReturnsCash,
        cashFundAdded,
        pettyCashWithdrawn,
        cashRefunds,
      });
    } catch (error) {
      console.error('Error loading day data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDenominationCount = (index: number, countStr: string) => {
    const count = parseInt(countStr) || 0;
    const updated = [...denominations];
    updated[index].count = count;
    setDenominations(updated);
  };

  // Calculate totals
  const totalCashCount = denominations.reduce((sum, d) => sum + (d.value * d.count), 0);
  const beginningCashNum = parseFloat(beginningCash) || 0;

  // Expected cash formula (complete cash reconciliation):
  // = Beginning Cash
  // + Cash Sales (cash received from sales)
  // + Customer Payments in Cash (AR collections)
  // + Cash Fund Added (opening fund, additional cash)
  // - Sales Returns Paid in Cash
  // - Supplier Payments in Cash
  // - Petty Cash Withdrawn
  // - Cash Refunds (from exchanges, etc.)
  const expectedCash = beginningCashNum +
    daySummary.cashSales +
    daySummary.customerPaymentsCash +
    daySummary.cashFundAdded -
    daySummary.salesReturnsCash -
    daySummary.supplierPaymentsCash -
    daySummary.pettyCashWithdrawn -
    daySummary.cashRefunds;

  const cashVariance = totalCashCount - expectedCash;
  const isShort = cashVariance < 0;
  const isOver = cashVariance > 0;

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: onConfirm },
      ]);
    }
  };

  const submitEndOfDay = async () => {
    if (totalCashCount === 0) {
      showAlert('Error', 'Please enter the cash breakdown count');
      return;
    }

    const varianceText = cashVariance === 0
      ? 'Cash is balanced.'
      : isShort
        ? `SHORT by ₱${Math.abs(cashVariance).toFixed(2)}`
        : `OVER by ₱${cashVariance.toFixed(2)}`;

    showConfirm(
      'Confirm End of Day',
      `Are you sure you want to close the day?\n\n` +
      `Expected Cash: ₱${expectedCash.toFixed(2)}\n` +
      `Actual Cash: ₱${totalCashCount.toFixed(2)}\n\n` +
      `${varianceText}`,
      async () => {
        setSubmitting(true);
        try {
          const dbService = getDatabase();

          const eodData = {
            date: new Date().toISOString().split('T')[0],
            beginning_cash: beginningCashNum,
            gross_sales: daySummary.grossSales,
            discounts: daySummary.discounts,
            sales_returns: daySummary.salesReturns,
            net_sales: daySummary.netSales,
            cash_sales: daySummary.cashSales,
            credit_sales: daySummary.creditSales,
            gcash_sales: daySummary.gcashSales,
            card_sales: daySummary.cardSales,
            other_sales: daySummary.otherSales,
            void_amount: daySummary.voidAmount,
            void_count: daySummary.voidCount,
            transaction_count: daySummary.transactionCount,
            customer_payments_received: daySummary.customerPaymentsTotal,
            supplier_payments_made: daySummary.supplierPaymentsTotal,
            expected_cash: expectedCash,
            actual_cash: totalCashCount,
            cash_variance: cashVariance,
            denomination_breakdown: denominations,
            next_day_beginning_cash: totalCashCount, // Carry forward actual cash
            created_by: user?.id || 1,
            status: 'COMPLETED',
          };

          const eodResult = await dbService.saveEndOfDay(eodData);

          // End the current shift
          if (user?.id) {
            const currentShift = await dbService.getCurrentShift(user.id);
            if (currentShift) {
              await dbService.endShift(currentShift.id, totalCashCount, eodResult);
            }
          }

          // Update beginning_cash setting for next day
          await dbService.updateSetting('beginning_cash', String(totalCashCount));

          showAlert(
            'End of Day Complete',
            `Z-Reading saved successfully!\n\n` +
            `Net Sales: ₱${daySummary.netSales.toFixed(2)}\n` +
            `${varianceText}\n\n` +
            `Tomorrow's beginning cash: ₱${totalCashCount.toFixed(2)}\n\n` +
            `Your shift has been closed. Start a new shift to make sales.`,
            () => {
              navigation.goBack();
            }
          );
        } catch (error) {
          console.error('Error saving EOD:', error);
          showAlert('Error', 'Failed to save End of Day record');
        } finally {
          setSubmitting(false);
        }
      }
    );
  };

  const webContainerStyle = Platform.OS === 'web'
    ? { height: 'calc(100vh - 64px)', overflow: 'hidden' as const }
    : {};

  const webScrollStyle = Platform.OS === 'web'
    ? { flex: 1, overflow: 'auto' as const }
    : {};

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Paragraph>Loading day summary...</Paragraph>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }, webContainerStyle]}>
      <ScrollView style={[styles.scrollView, webScrollStyle]} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Title style={styles.pageTitle}>End of Day (Z-Reading)</Title>
          <Button
            mode={showHistory ? 'contained' : 'outlined'}
            onPress={() => setShowHistory(!showHistory)}
            compact
          >
            {showHistory ? 'New EOD' : 'History'}
          </Button>
        </View>

        {showHistory ? (
          // EOD History
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>EOD History</Title>
              {eodHistory.length === 0 ? (
                <Paragraph style={styles.emptyText}>No EOD records yet</Paragraph>
              ) : (
                eodHistory.slice(0, 10).map((eod, index) => (
                  <View key={eod.id || index}>
                    <List.Item
                      title={`${eod.date} - Z-Reading #${eod.id}`}
                      description={`Net Sales: ₱${(eod.net_sales || 0).toFixed(2)} | Variance: ₱${(eod.cash_variance || 0).toFixed(2)}`}
                      left={props => (
                        <List.Icon
                          {...props}
                          icon="file-document"
                          color={eod.cash_variance === 0 ? '#4CAF50' : eod.cash_variance < 0 ? '#F44336' : '#FF9800'}
                        />
                      )}
                    />
                    {index < eodHistory.length - 1 && <Divider />}
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        ) : (
          <>
            {/* Date Header */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.dateHeader}>
                  <Title style={styles.dateTitle}>
                    {new Date().toLocaleDateString('en-PH', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Title>
                  <Paragraph>Cashier: {user?.full_name || 'Unknown'}</Paragraph>
                </View>
              </Card.Content>
            </Card>

            {/* Beginning Cash */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Beginning Cash on Hand</Title>
                <TextInput
                  label="Beginning Cash (₱)"
                  value={beginningCash}
                  onChangeText={setBeginningCash}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  left={<TextInput.Affix text="₱" />}
                />
              </Card.Content>
            </Card>

            {/* Sales Summary */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Sales Summary</Title>
                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell>Gross Sales</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.grossSales.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>Less: Discounts</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.discounts.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row style={styles.totalRow}>
                    <DataTable.Cell><Paragraph style={styles.bold}>Net Sales</Paragraph></DataTable.Cell>
                    <DataTable.Cell numeric><Paragraph style={styles.bold}>₱{daySummary.netSales.toFixed(2)}</Paragraph></DataTable.Cell>
                  </DataTable.Row>
                </DataTable>

                <Divider style={styles.divider} />
                <Paragraph style={styles.subHeader}>Sales by Payment Method:</Paragraph>
                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell>💵 Cash</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.cashSales.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>📝 Check</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.checkSales.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>💳 Card</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.cardSales.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>📱 GCash/Online</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.gcashSales.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>📋 Charge Invoice (AR)</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.creditSales.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  {daySummary.otherSales > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Other</DataTable.Cell>
                      <DataTable.Cell numeric>₱{daySummary.otherSales.toFixed(2)}</DataTable.Cell>
                    </DataTable.Row>
                  )}
                </DataTable>

                <Divider style={styles.divider} />
                <Paragraph style={styles.subHeader}>Void Transactions:</Paragraph>
                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell>Void ({daySummary.voidCount})</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.voidAmount.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                </DataTable>

                <Divider style={styles.divider} />
                <Paragraph style={styles.statsText}>
                  Total Transactions: {daySummary.transactionCount}
                </Paragraph>
              </Card.Content>
            </Card>

            {/* AR Collections (Customer Payments) */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>AR Collections (Customer Payments)</Title>
                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell>💵 Cash</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.customerPaymentsCash.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>📝 Check</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.customerPaymentsCheck.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>💳 Card</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.customerPaymentsCard.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>📱 GCash/Online</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.customerPaymentsOnline.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>🏦 Bank Transfer</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.customerPaymentsBankTransfer.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row style={styles.totalRow}>
                    <DataTable.Cell><Paragraph style={styles.bold}>Total Collections</Paragraph></DataTable.Cell>
                    <DataTable.Cell numeric><Paragraph style={styles.bold}>₱{daySummary.customerPaymentsTotal.toFixed(2)}</Paragraph></DataTable.Cell>
                  </DataTable.Row>
                </DataTable>
              </Card.Content>
            </Card>

            {/* Supplier Payments */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Supplier Payments (Cash Out)</Title>
                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell>💵 Cash</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.supplierPaymentsCash.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>📝 Check</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.supplierPaymentsCheck.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>🏦 Bank Transfer</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.supplierPaymentsBankTransfer.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row style={styles.expectedRow}>
                    <DataTable.Cell><Paragraph style={styles.bold}>Total Disbursements</Paragraph></DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}><Paragraph style={styles.bold}>(₱{daySummary.supplierPaymentsTotal.toFixed(2)})</Paragraph></DataTable.Cell>
                  </DataTable.Row>
                </DataTable>
              </Card.Content>
            </Card>

            {/* Sales Returns */}
            {daySummary.salesReturns > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Title style={styles.sectionTitle}>Sales Returns / Refunds</Title>
                  <DataTable>
                    <DataTable.Row>
                      <DataTable.Cell>Cash Refunds</DataTable.Cell>
                      <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.salesReturnsCash.toFixed(2)})</DataTable.Cell>
                    </DataTable.Row>
                    <DataTable.Row>
                      <DataTable.Cell>Total Returns</DataTable.Cell>
                      <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.salesReturns.toFixed(2)})</DataTable.Cell>
                    </DataTable.Row>
                  </DataTable>
                  <Paragraph style={styles.noteText}>
                    Note: Only cash refunds affect the cash drawer count.
                  </Paragraph>
                </Card.Content>
              </Card>
            )}

            {/* Cash Breakdown */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Cash Breakdown Count</Title>
                <Paragraph style={styles.instructionText}>
                  Count the bills and coins in your cash drawer:
                </Paragraph>

                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>Denomination</DataTable.Title>
                    <DataTable.Title numeric>Count</DataTable.Title>
                    <DataTable.Title numeric>Amount</DataTable.Title>
                  </DataTable.Header>

                  {denominations.map((denom, index) => (
                    <DataTable.Row key={denom.value}>
                      <DataTable.Cell>{denom.label}</DataTable.Cell>
                      <DataTable.Cell numeric>
                        <TextInput
                          value={denom.count === 0 ? '' : String(denom.count)}
                          onChangeText={(text) => updateDenominationCount(index, text)}
                          keyboardType="number-pad"
                          style={styles.countInput}
                          dense
                          placeholder="0"
                        />
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        ₱{(denom.value * denom.count).toFixed(2)}
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}

                  <DataTable.Row style={styles.totalRow}>
                    <DataTable.Cell><Paragraph style={styles.bold}>TOTAL CASH</Paragraph></DataTable.Cell>
                    <DataTable.Cell numeric></DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Paragraph style={styles.bold}>₱{totalCashCount.toFixed(2)}</Paragraph>
                    </DataTable.Cell>
                  </DataTable.Row>
                </DataTable>
              </Card.Content>
            </Card>

            {/* Cash Accountability */}
            <Card style={[styles.card, styles.accountabilityCard]}>
              <Card.Content>
                <Title style={styles.sectionTitle}>💵 Cash Drawer Accountability</Title>
                <Paragraph style={styles.noteText}>
                  Only CASH transactions are included in this calculation.
                </Paragraph>

                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell>Beginning Cash</DataTable.Cell>
                    <DataTable.Cell numeric>₱{beginningCashNum.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>Add: Cash Sales</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.cashSales.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>Add: AR Collections (Cash)</DataTable.Cell>
                    <DataTable.Cell numeric>₱{daySummary.customerPaymentsCash.toFixed(2)}</DataTable.Cell>
                  </DataTable.Row>
                  {daySummary.cashFundAdded > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Add: Cash Fund Added</DataTable.Cell>
                      <DataTable.Cell numeric>₱{daySummary.cashFundAdded.toFixed(2)}</DataTable.Cell>
                    </DataTable.Row>
                  )}
                  <DataTable.Row>
                    <DataTable.Cell>Less: Sales Returns (Cash)</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.salesReturnsCash.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>Less: Cash Paid to Suppliers</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.supplierPaymentsCash.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  {daySummary.pettyCashWithdrawn > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Less: Petty Cash Withdrawn</DataTable.Cell>
                      <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.pettyCashWithdrawn.toFixed(2)})</DataTable.Cell>
                    </DataTable.Row>
                  )}
                  {daySummary.cashRefunds > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Less: Exchange/Other Refunds</DataTable.Cell>
                      <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.cashRefunds.toFixed(2)})</DataTable.Cell>
                    </DataTable.Row>
                  )}
                  <DataTable.Row style={styles.expectedRow}>
                    <DataTable.Cell><Paragraph style={styles.bold}>Expected Cash in Drawer</Paragraph></DataTable.Cell>
                    <DataTable.Cell numeric><Paragraph style={styles.bold}>₱{expectedCash.toFixed(2)}</Paragraph></DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell><Paragraph style={styles.bold}>Actual Cash (Counted)</Paragraph></DataTable.Cell>
                    <DataTable.Cell numeric><Paragraph style={styles.bold}>₱{totalCashCount.toFixed(2)}</Paragraph></DataTable.Cell>
                  </DataTable.Row>
                </DataTable>

                <Divider style={styles.divider} />

                <View style={styles.varianceRow}>
                  <Title style={styles.varianceLabel}>Over/Short:</Title>
                  <Chip
                    mode="flat"
                    style={[
                      styles.varianceChip,
                      cashVariance === 0 ? styles.balanced : isShort ? styles.short : styles.over
                    ]}
                    textStyle={styles.varianceText}
                  >
                    {cashVariance === 0
                      ? 'BALANCED'
                      : isShort
                        ? `SHORT ₱${Math.abs(cashVariance).toFixed(2)}`
                        : `OVER ₱${cashVariance.toFixed(2)}`}
                  </Chip>
                </View>
              </Card.Content>
            </Card>

            {/* Submit Button */}
            <Button
              mode="contained"
              onPress={submitEndOfDay}
              loading={submitting}
              disabled={submitting}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
              icon="check-circle"
            >
              Complete End of Day
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  dateHeader: {
    alignItems: 'center',
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subHeader: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.8,
  },
  input: {
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  totalRow: {
    backgroundColor: '#E8F5E9',
  },
  expectedRow: {
    backgroundColor: '#FFF3E0',
  },
  bold: {
    fontWeight: 'bold',
  },
  deduction: {
    color: '#F44336',
  },
  statsText: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  instructionText: {
    marginBottom: 12,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  countInput: {
    width: 60,
    height: 36,
    textAlign: 'center',
    backgroundColor: '#FFF',
  },
  accountabilityCard: {
    backgroundColor: '#F5F5F5',
  },
  varianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  varianceLabel: {
    fontSize: 18,
  },
  varianceChip: {
    paddingHorizontal: 12,
  },
  varianceText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  balanced: {
    backgroundColor: '#C8E6C9',
  },
  short: {
    backgroundColor: '#FFCDD2',
  },
  over: {
    backgroundColor: '#FFE0B2',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.6,
    paddingVertical: 16,
  },
  noteText: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
    marginBottom: 8,
  },
});
