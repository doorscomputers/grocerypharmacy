import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'CashCount'>;
};

interface Denomination {
  value: number;
  label: string;
  type: 'bill' | 'coin';
  count: string;
}

interface CashSummary {
  beginningCash: number;
  cashSales: number;
  customerPaymentsCash: number;
  cashFundAdded: number;
  salesReturnsCash: number;
  supplierPaymentsCash: number;
  pettyCashWithdrawn: number;
  cashRefunds: number;
}

export default function CashCountScreen({ navigation }: Props) {
  const { user } = useAuth();

  // Philippine peso denominations
  const [denominations, setDenominations] = useState<Denomination[]>([
    // Bills
    { value: 1000, label: '₱1,000', type: 'bill', count: '' },
    { value: 500, label: '₱500', type: 'bill', count: '' },
    { value: 200, label: '₱200', type: 'bill', count: '' },
    { value: 100, label: '₱100', type: 'bill', count: '' },
    { value: 50, label: '₱50', type: 'bill', count: '' },
    { value: 20, label: '₱20', type: 'bill', count: '' },
    // Coins
    { value: 20, label: '₱20 (coin)', type: 'coin', count: '' },
    { value: 10, label: '₱10', type: 'coin', count: '' },
    { value: 5, label: '₱5', type: 'coin', count: '' },
    { value: 1, label: '₱1', type: 'coin', count: '' },
    { value: 0.25, label: '25¢', type: 'coin', count: '' },
    { value: 0.10, label: '10¢', type: 'coin', count: '' },
    { value: 0.05, label: '5¢', type: 'coin', count: '' },
  ]);

  const [cashSummary, setCashSummary] = useState<CashSummary>({
    beginningCash: 0,
    cashSales: 0,
    customerPaymentsCash: 0,
    cashFundAdded: 0,
    salesReturnsCash: 0,
    supplierPaymentsCash: 0,
    pettyCashWithdrawn: 0,
    cashRefunds: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCashData();
  }, []);

  const loadCashData = async () => {
    setIsLoading(true);
    try {
      const dbService = getDatabase();
      const today = new Date().toISOString().split('T')[0];

      // Get today's transactions
      const todayTransactions = await dbService.getTodaysTransactions();
      const completedTransactions = todayTransactions.filter((t: any) => t.status === 'COMPLETED');

      // Get today's sales returns
      const allReturns = await dbService.getSalesReturns();
      const todayReturns = allReturns.filter((r: any) => r.created_at?.startsWith(today));

      // Get customer payments
      const allCustomerPayments = await dbService.getCustomerPayments();
      const todayCustomerPayments = allCustomerPayments.filter((p: any) => p.created_at?.startsWith(today));

      // Get supplier payments
      const allSupplierPayments = await dbService.getSupplierPayments();
      const todaySupplierPayments = allSupplierPayments.filter((p: any) => p.created_at?.startsWith(today));

      // Get cash movements
      const todayCashMovements = await dbService.getCashMovements(today);

      // Get EOD history for beginning cash
      const eodRecords = await dbService.getEndOfDayRecords();
      let beginningCash = 0;
      const lastEod = eodRecords?.[0];
      if (lastEod?.next_day_beginning_cash) {
        beginningCash = lastEod.next_day_beginning_cash;
      } else {
        const savedBeginningCash = await dbService.getSetting('beginning_cash');
        if (savedBeginningCash) {
          beginningCash = parseFloat(savedBeginningCash) || 0;
        }
      }

      // Calculate cash values
      const cashSales = completedTransactions
        .filter((t: any) => t.payment_method === 'CASH')
        .reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

      const customerPaymentsCash = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'CASH')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      const supplierPaymentsCash = todaySupplierPayments
        .filter((p: any) => p.payment_method === 'CASH')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      const salesReturnsCash = todayReturns
        .filter((r: any) => r.refund_method === 'CASH')
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);

      const cashFundAdded = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'OPENING_FUND' || m.movement_type === 'CASH_IN')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

      const pettyCashWithdrawn = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'PETTY_CASH' || m.movement_type === 'CASH_OUT')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

      const cashRefunds = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'CASH_REFUND')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

      setCashSummary({
        beginningCash,
        cashSales,
        customerPaymentsCash,
        cashFundAdded,
        salesReturnsCash,
        supplierPaymentsCash,
        pettyCashWithdrawn,
        cashRefunds,
      });
    } catch (error) {
      console.error('Error loading cash data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCount = (index: number, value: string) => {
    const updated = [...denominations];
    // Only allow numbers
    updated[index].count = value.replace(/[^0-9]/g, '');
    setDenominations(updated);
  };

  const incrementCount = (index: number) => {
    const updated = [...denominations];
    const currentCount = parseInt(updated[index].count) || 0;
    updated[index].count = String(currentCount + 1);
    setDenominations(updated);
  };

  const decrementCount = (index: number) => {
    const updated = [...denominations];
    const currentCount = parseInt(updated[index].count) || 0;
    if (currentCount > 0) {
      updated[index].count = String(currentCount - 1);
    }
    setDenominations(updated);
  };

  const clearAll = () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all denomination counts?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setDenominations(denominations.map(d => ({ ...d, count: '' })));
          },
        },
      ]
    );
  };

  // Calculate totals
  const totalBills = denominations
    .filter(d => d.type === 'bill')
    .reduce((sum, d) => sum + (d.value * (parseInt(d.count) || 0)), 0);

  const totalCoins = denominations
    .filter(d => d.type === 'coin')
    .reduce((sum, d) => sum + (d.value * (parseInt(d.count) || 0)), 0);

  const totalCashCount = totalBills + totalCoins;

  // Expected cash calculation
  const expectedCash =
    cashSummary.beginningCash +
    cashSummary.cashSales +
    cashSummary.customerPaymentsCash +
    cashSummary.cashFundAdded -
    cashSummary.salesReturnsCash -
    cashSummary.supplierPaymentsCash -
    cashSummary.pettyCashWithdrawn -
    cashSummary.cashRefunds;

  const variance = totalCashCount - expectedCash;
  const isShort = variance < 0;
  const isOver = variance > 0;
  const isBalanced = variance === 0;

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const goToEndOfDay = () => {
    navigation.navigate('EndOfDay');
  };

  const bills = denominations.filter(d => d.type === 'bill');
  const coins = denominations.filter(d => d.type === 'coin');

  const renderDenomination = (denom: Denomination, index: number, globalIndex: number) => (
    <View key={`${denom.type}-${denom.value}-${index}`} style={styles.denomRow}>
      <Text style={styles.denomLabel}>{denom.label}</Text>
      <View style={styles.countContainer}>
        <TouchableOpacity
          style={styles.countButton}
          onPress={() => decrementCount(globalIndex)}
        >
          <Text style={styles.countButtonText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.countInput}
          value={denom.count}
          onChangeText={(text) => updateCount(globalIndex, text)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#9E9E9E"
          textAlign="center"
        />
        <TouchableOpacity
          style={styles.countButton}
          onPress={() => incrementCount(globalIndex)}
        >
          <Text style={styles.countButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.denomTotal}>
        {formatCurrency(denom.value * (parseInt(denom.count) || 0))}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#FFFFFF"
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.headerTitle}>Cash Count</Text>
        <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Expected vs Actual Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expected</Text>
              <Text style={styles.summaryValue}>{formatCurrency(expectedCash)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Actual</Text>
              <Text style={[styles.summaryValue, styles.actualValue]}>{formatCurrency(totalCashCount)}</Text>
            </View>
          </View>
          <Divider style={styles.summaryDivider} />
          <View style={styles.varianceContainer}>
            <Text style={styles.varianceLabel}>Over/Short:</Text>
            <View style={[
              styles.varianceBadge,
              isBalanced ? styles.balancedBadge : isShort ? styles.shortBadge : styles.overBadge
            ]}>
              <Text style={styles.varianceText}>
                {isBalanced ? 'BALANCED' : isShort ? `SHORT ${formatCurrency(Math.abs(variance))}` : `OVER ${formatCurrency(variance)}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Bills Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💵 Bills</Text>
            <Text style={styles.sectionTotal}>{formatCurrency(totalBills)}</Text>
          </View>
          {bills.map((denom, index) => renderDenomination(denom, index, index))}
        </View>

        {/* Coins Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🪙 Coins</Text>
            <Text style={styles.sectionTotal}>{formatCurrency(totalCoins)}</Text>
          </View>
          {coins.map((denom, index) => renderDenomination(denom, index, bills.length + index))}
        </View>

        {/* Cash Flow Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={styles.breakdownTitle}>Cash Flow Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Beginning Cash</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(cashSummary.beginningCash)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>+ Cash Sales</Text>
            <Text style={[styles.breakdownValue, styles.addValue]}>{formatCurrency(cashSummary.cashSales)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>+ AR Collections (Cash)</Text>
            <Text style={[styles.breakdownValue, styles.addValue]}>{formatCurrency(cashSummary.customerPaymentsCash)}</Text>
          </View>
          {cashSummary.cashFundAdded > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>+ Cash Fund Added</Text>
              <Text style={[styles.breakdownValue, styles.addValue]}>{formatCurrency(cashSummary.cashFundAdded)}</Text>
            </View>
          )}
          {cashSummary.salesReturnsCash > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>- Sales Returns (Cash)</Text>
              <Text style={[styles.breakdownValue, styles.lessValue]}>({formatCurrency(cashSummary.salesReturnsCash)})</Text>
            </View>
          )}
          {cashSummary.supplierPaymentsCash > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>- Supplier Payments (Cash)</Text>
              <Text style={[styles.breakdownValue, styles.lessValue]}>({formatCurrency(cashSummary.supplierPaymentsCash)})</Text>
            </View>
          )}
          {cashSummary.pettyCashWithdrawn > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>- Petty Cash Withdrawn</Text>
              <Text style={[styles.breakdownValue, styles.lessValue]}>({formatCurrency(cashSummary.pettyCashWithdrawn)})</Text>
            </View>
          )}
          {cashSummary.cashRefunds > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>- Exchange/Other Refunds</Text>
              <Text style={[styles.breakdownValue, styles.lessValue]}>({formatCurrency(cashSummary.cashRefunds)})</Text>
            </View>
          )}
          <View style={[styles.breakdownRow, styles.expectedRow]}>
            <Text style={styles.expectedLabel}>= Expected Cash</Text>
            <Text style={styles.expectedValue}>{formatCurrency(expectedCash)}</Text>
          </View>
        </View>

        {/* Go to End of Day Button */}
        <TouchableOpacity style={styles.eodButton} onPress={goToEndOfDay}>
          <Text style={styles.eodButtonText}>📊 Proceed to End of Day (Z-Reading)</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating Total */}
      <View style={styles.floatingTotal}>
        <View style={styles.totalInfo}>
          <Text style={styles.totalLabel}>Total Cash Counted</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalCashCount)}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00897B',
    paddingRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  actualValue: {
    color: '#00897B',
  },
  summaryDivider: {
    marginVertical: 12,
  },
  varianceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  varianceLabel: {
    fontSize: 14,
    color: '#757575',
    marginRight: 8,
  },
  varianceBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  balancedBadge: {
    backgroundColor: '#E8F5E9',
  },
  shortBadge: {
    backgroundColor: '#FFEBEE',
  },
  overBadge: {
    backgroundColor: '#FFF3E0',
  },
  varianceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  sectionTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00897B',
  },
  denomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  denomLabel: {
    width: 100,
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
  },
  countContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#424242',
  },
  countInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginHorizontal: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    backgroundColor: '#FAFAFA',
  },
  denomTotal: {
    width: 90,
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
    textAlign: 'right',
  },
  breakdownSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#616161',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  addValue: {
    color: '#2E7D32',
  },
  lessValue: {
    color: '#C62828',
  },
  expectedRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  expectedLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  expectedValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00897B',
  },
  eodButton: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  eodButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 100,
  },
  floatingTotal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 70,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  totalInfo: {
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#00897B',
  },
});
