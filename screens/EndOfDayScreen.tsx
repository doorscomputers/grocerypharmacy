import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Modal,
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
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import { useAuth } from '../contexts/AuthContext';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import { buildZReading, PRINTER_WIDTH } from '../utils/escpos';
import {
  ZReadingPdfData,
  printZReadingPdf,
  shareZReadingPdf,
  emailZReadingPdf,
} from '../utils/ReceiptPdfService';
import { getPhilippineDateString } from '../utils/dateTime';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'EndOfDay'>;
  route: RouteProp<RootStackParamList, 'EndOfDay'>;
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
  refundCount: number;
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
  exchangeAmount: number;
  exchangeCount: number;
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
  openingFund: number;        // OPENING_FUND
  cashIn: number;             // CASH_IN
  cashOut: number;            // CASH_OUT
  pettyCash: number;          // PETTY_CASH
  cashFundAdded: number;      // OPENING_FUND + CASH_IN (for backward compatibility)
  pettyCashWithdrawn: number; // PETTY_CASH + CASH_OUT (for backward compatibility)
  cashRefunds: number;        // CASH_REFUND (from exchanges, etc.)
}

// Use device's local date (device should be set to Philippine timezone)
const getPhilippineDate = (): string => {
  return getPhilippineDateString();
};

export default function EndOfDayScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();
  const { user } = useAuth();

  // Get target date from navigation params (for closing unterminated sessions)
  // If no target date provided, use today's date in Philippine timezone
  const targetDate = route?.params?.targetDate || getPhilippineDate();

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
    refundCount: 0,
    netSales: 0,
    cashSales: 0,
    creditSales: 0,
    gcashSales: 0,
    cardSales: 0,
    checkSales: 0,
    otherSales: 0,
    voidAmount: 0,
    voidCount: 0,
    exchangeAmount: 0,
    exchangeCount: 0,
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
    openingFund: 0,
    cashIn: 0,
    cashOut: 0,
    pettyCash: 0,
    cashFundAdded: 0,
    pettyCashWithdrawn: 0,
    cashRefunds: 0,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eodHistory, setEodHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentShift, setCurrentShift] = useState<{ id: number; start_time: string } | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);

  // Print/Export/Email states
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isHistoryPrinting, setIsHistoryPrinting] = useState(false);
  const [isHistoryExporting, setIsHistoryExporting] = useState(false);
  const [isHistoryEmailing, setIsHistoryEmailing] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<{ name: string; address: string; tin: string }>({
    name: '',
    address: '',
    tin: '',
  });

  // Post-EOD completion dialog
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<{
    netSales: number;
    variance: number;
    cashCounted: number;
    xReadingFailed?: boolean;
  } | null>(null);

  useEffect(() => {
    loadDayData();
    loadBusinessInfo();
  }, []);

  const loadBusinessInfo = async () => {
    try {
      const dbService = getDatabase();
      const [name, address, tin] = await Promise.all([
        dbService.getSetting('company_name'),
        dbService.getSetting('company_address'),
        dbService.getSetting('company_tin'),
      ]);
      setBusinessInfo({
        name: name || 'Store',
        address: address || '',
        tin: tin || '',
      });
    } catch (error) {
      console.error('Error loading business info:', error);
    }
  };

  const loadDayData = async () => {
    setLoading(true);
    try {
      const dbService = getDatabase();

      // Check if we're closing a past date (unterminated session)
      const today = getPhilippineDate();
      const isClosingPastDate = targetDate !== today;

      // Always get current shift for this user (we need to close it regardless of target date)
      let shiftStartTime: string | undefined;
      if (user?.id) {
        const shift = await dbService.getCurrentShift(user.id);
        if (shift) {
          setCurrentShift({ id: shift.id, start_time: shift.start_time });
          // Only use shift time for filtering if closing today
          if (!isClosingPastDate) {
            shiftStartTime = shift.start_time;
          }
        }
      }

      // Get transactions - filter by shift if closing today, otherwise by target date
      // Always filter by logged-in user to only show this cashier's transactions
      let todayTransactions;
      if (isClosingPastDate) {
        // Closing a past date - get all transactions for that specific date by this cashier
        todayTransactions = await dbService.getTransactionsByDate(targetDate, user?.id);
      } else if (shiftStartTime) {
        // Get transactions from shift start time onwards by this cashier
        todayTransactions = await dbService.getTransactionsSinceTime(shiftStartTime, user?.id);
      } else {
        // Fall back to today's transactions (already filtered by date)
        const allToday = await dbService.getTodaysTransactions();
        todayTransactions = user?.id
          ? allToday.filter((t: any) => t.cashier_id === user.id)
          : allToday;
      }

      // Normalize shift time for JavaScript string comparison
      // Convert ISO format "2026-01-31T20:50:43.000Z" to "2026-01-31 20:50:43"
      const normalizedShiftTime = shiftStartTime
        ? shiftStartTime.replace('T', ' ').replace('Z', '').split('.')[0]
        : undefined;

      // Get sales returns - filter by shift if exists, otherwise by target date
      // Also filter by this cashier (processed_by)
      const allReturns = await dbService.getSalesReturns();
      const todayReturns = normalizedShiftTime
        ? allReturns.filter((r: any) => r.created_at >= normalizedShiftTime && r.processed_by === user?.id)
        : allReturns.filter((r: any) => r.created_at?.startsWith(targetDate) && r.processed_by === user?.id);

      // Get customer payments - filter by payment_date (for date) and created_at (for shift)
      // Also filter by this cashier (received_by)
      // Note: customer_payments table uses 'received_by' and 'amount_paid' columns
      // IMPORTANT: Always filter by payment_date to ensure we only get today's payments
      const allCustomerPayments = await dbService.getCustomerPayments(undefined, 500);
      console.log('[EOD] All customer payments:', JSON.stringify(allCustomerPayments.map((p: any) => ({ id: p.id, payment_date: p.payment_date, amount_paid: p.amount_paid, payment_method: p.payment_method, received_by: p.received_by }))));
      const todayCustomerPayments = normalizedShiftTime
        ? allCustomerPayments.filter((p: any) => p.payment_date?.startsWith(targetDate) && p.created_at >= normalizedShiftTime && p.received_by === user?.id)
        : allCustomerPayments.filter((p: any) => p.payment_date?.startsWith(targetDate) && p.received_by === user?.id);
      console.log('[EOD] Today customer payments:', JSON.stringify(todayCustomerPayments.map((p: any) => ({ id: p.id, payment_date: p.payment_date, amount_paid: p.amount_paid, payment_method: p.payment_method }))));

      // Get supplier payments - filter by shift if exists, otherwise by target date
      // Also filter by this cashier (created_by)
      const allSupplierPayments = await dbService.getSupplierPayments();
      const todaySupplierPayments = normalizedShiftTime
        ? allSupplierPayments.filter((p: any) => p.created_at >= normalizedShiftTime && p.created_by === user?.id)
        : allSupplierPayments.filter((p: any) => p.created_at?.startsWith(targetDate) && p.created_by === user?.id);

      // Get cash movements - filter by shift if exists, otherwise by target date
      // Also filter by this cashier (cashier_id)
      const allCashMovements = await dbService.getCashMovements(targetDate);
      const todayCashMovements = normalizedShiftTime
        ? (allCashMovements || []).filter((m: any) => m.created_at >= normalizedShiftTime && m.cashier_id === user?.id)
        : (allCashMovements || []).filter((m: any) => m.cashier_id === user?.id);

      // Get EOD history
      const eodRecords = await dbService.getEndOfDayRecords();
      setEodHistory(eodRecords || []);

      // Get beginning cash ONLY from current shift (entered by cashier when starting shift)
      // Do NOT auto-fill from previous day - each day is independent
      if (user?.id) {
        const shift = await dbService.getCurrentShift(user.id);
        if (shift?.beginning_cash !== undefined) {
          setBeginningCash(String(shift.beginning_cash));
        } else {
          // No active shift - default to 0, cashier must enter manually
          // NOTE: We intentionally do NOT fall back to previous EOD or settings
          // Each day starts fresh with what the cashier actually has
          setBeginningCash('0');
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
      // Exclude exchanges from refund total (exchanges are tracked separately)
      const salesReturnsCash = todayReturns
        .filter((r: any) => r.refund_method === 'CASH')
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      const salesReturnsTotal = todayReturns
        .filter((r: any) => r.refund_method !== 'EXCHANGE')
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      const refundCount = todayReturns
        .filter((r: any) => r.refund_method !== 'EXCHANGE').length;

      // Exchange transactions (separate from refunds)
      const exchangeAmount = todayReturns
        .filter((r: any) => r.refund_method === 'EXCHANGE')
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      const exchangeCount = todayReturns
        .filter((r: any) => r.refund_method === 'EXCHANGE').length;

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
      // Note: customer_payments table uses 'amount_paid' column
      const customerPaymentsCash = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'CASH')
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
      const customerPaymentsCheck = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'CHECK')
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
      const customerPaymentsCard = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'CARD' || p.payment_method === 'CREDIT_CARD')
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
      const customerPaymentsOnline = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'ONLINE' || p.payment_method === 'GCASH')
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
      const customerPaymentsBankTransfer = todayCustomerPayments
        .filter((p: any) => p.payment_method === 'BANK_TRANSFER')
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
      const customerPaymentsTotal = todayCustomerPayments
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);

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
      const openingFund = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'OPENING_FUND')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
      const cashIn = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'CASH_IN')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
      const cashOut = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'CASH_OUT')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
      const pettyCash = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'PETTY_CASH')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
      const cashFundAdded = openingFund + cashIn;  // For backward compatibility
      const pettyCashWithdrawn = pettyCash + cashOut;  // For backward compatibility
      const cashRefunds = (todayCashMovements || [])
        .filter((m: any) => m.movement_type === 'CASH_REFUND')
        .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

      setDaySummary({
        grossSales,
        discounts,
        salesReturns: salesReturnsTotal,
        refundCount,
        netSales: grossSales - discounts,
        cashSales,
        creditSales,
        gcashSales,
        cardSales,
        checkSales,
        otherSales,
        voidAmount: voidedTransactions.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0),
        voidCount: voidedTransactions.length,
        exchangeAmount,
        exchangeCount,
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
        openingFund,
        cashIn,
        cashOut,
        pettyCash,
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
  // - Sales Returns Paid in Cash (from sales_returns where refund_method='CASH')
  // - Cash Refunds recorded in cash_movements (CASH_REFUND type)
  // - Petty Cash Withdrawn (includes any cash taken from drawer for supplier payments)
  // NOTE: Use MAX of salesReturnsCash and cashRefunds to avoid double-counting
  // while catching both old refunds (only in sales_returns) and new refunds (in both)
  const totalCashRefundsOut = Math.max(daySummary.salesReturnsCash, daySummary.cashRefunds);
  const expectedCash = beginningCashNum +
    daySummary.cashSales +
    daySummary.customerPaymentsCash +
    daySummary.cashFundAdded -
    totalCashRefundsOut -
    daySummary.pettyCashWithdrawn;

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

  // Build Z-Reading data for print/export
  const buildZReadingData = (): ZReadingPdfData => {
    return {
      businessName: businessInfo.name,
      businessAddress: businessInfo.address,
      tin: businessInfo.tin,
      date: new Date(targetDate + 'T00:00:00').toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      zReadingNumber: (eodHistory.length + 1).toString(),
      cashierName: user?.full_name || user?.username || 'Cashier',
      // Sales Summary
      transaction_count: daySummary.transactionCount,
      gross_sales: daySummary.grossSales,
      discount_amount: daySummary.discounts,
      sales_returns: daySummary.salesReturns,
      net_sales: daySummary.netSales,
      // VAT (calculate from gross sales)
      vat_sales: daySummary.grossSales / 1.12,
      vat_amount: daySummary.grossSales - (daySummary.grossSales / 1.12),
      vat_exempt_sales: 0,
      zero_rated_sales: 0,
      // Payment Methods
      cash_sales: daySummary.cashSales,
      card_sales: daySummary.cardSales,
      check_sales: daySummary.checkSales,
      credit_sales: daySummary.creditSales,
      online_sales: daySummary.gcashSales,
      // Voids
      void_count: daySummary.voidCount,
      void_amount: daySummary.voidAmount,
      // Exchanges
      exchange_count: daySummary.exchangeCount,
      exchange_amount: daySummary.exchangeAmount,
      // Refunds
      refund_count: daySummary.refundCount,
      // AR Collections
      customer_payments_cash: daySummary.customerPaymentsCash,
      customer_payments_check: daySummary.customerPaymentsCheck,
      customer_payments_card: daySummary.customerPaymentsCard,
      customer_payments_online: daySummary.customerPaymentsOnline,
      customer_payments_bank_transfer: daySummary.customerPaymentsBankTransfer,
      customer_payments_total: daySummary.customerPaymentsTotal,
      // Supplier Payments
      supplier_payments_made: daySummary.supplierPaymentsTotal,
      // Cash Drawer
      beginning_cash: beginningCashNum,
      opening_fund: daySummary.openingFund,
      cash_in: daySummary.cashIn,
      cash_out: daySummary.cashOut,
      cash_fund: daySummary.cashFundAdded,
      petty_cash: daySummary.pettyCash,
      cash_refunds: totalCashRefundsOut,
      expected_cash: expectedCash,
      actual_cash: totalCashCount,
      cash_variance: cashVariance,
    };
  };

  // Get paper width setting
  const getPaperWidth = (): '58mm' | '80mm' => {
    const printerService = BluetoothPrinterService.getInstance();
    const settings = printerService.getSettings();
    return settings.printerWidth === PRINTER_WIDTH.MM_80 ? '80mm' : '58mm';
  };

  // Print Z-Reading
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const printerService = BluetoothPrinterService.getInstance();

      if (printerService.isConnected()) {
        // Bluetooth thermal printer
        const settings = printerService.getSettings();
        const printerWidth = settings.printerWidth;

        const zReadingBuilder = buildZReading(
          {
            businessName: businessInfo.name,
            tin: businessInfo.tin,
            zReadingNumber: eodHistory.length + 1,
            date: new Date(),
            resetCounter: eodHistory.length + 1,
            beginningOR: '',
            endingOR: '',
            grossSales: daySummary.grossSales,
            regularDiscount: daySummary.discounts,
            seniorDiscount: 0,
            voidAmount: daySummary.voidAmount,
            returnAmount: daySummary.salesReturns,
            netSales: daySummary.netSales,
            vatableSales: daySummary.grossSales / 1.12,
            vatAmount: daySummary.grossSales - (daySummary.grossSales / 1.12),
            vatExemptSales: 0,
            zeroRatedSales: 0,
            transactionCount: daySummary.transactionCount,
            cashierName: user?.full_name || user?.username || 'Cashier',
            voidCount: daySummary.voidCount,
            exchangeCount: daySummary.exchangeCount,
            exchangeAmount: daySummary.exchangeAmount,
            refundCount: daySummary.refundCount,
            refundAmount: daySummary.salesReturns,
            beginningCash: parseFloat(beginningCash || '0'),
            openingFund: daySummary.openingFund,
            cashIn: daySummary.cashIn,
            cashOut: daySummary.cashOut,
            cashSales: daySummary.cashSales,
            customerPaymentsCash: daySummary.customerPaymentsCash,
            customerPaymentsCheck: daySummary.customerPaymentsCheck,
            customerPaymentsCard: daySummary.customerPaymentsCard,
            customerPaymentsOnline: daySummary.customerPaymentsOnline,
            customerPaymentsBankTransfer: daySummary.customerPaymentsBankTransfer,
            customerPaymentsTotal: daySummary.customerPaymentsTotal,
            supplierPaymentsMade: daySummary.supplierPaymentsTotal,
            cashFund: daySummary.cashFundAdded,
            pettyCash: daySummary.pettyCash,
            cashRefunds: totalCashRefundsOut,
            expectedCash: expectedCash,
            actualCash: totalCashCount,
            cashVariance: cashVariance,
          },
          printerWidth
        );

        await printerService.print(zReadingBuilder);
        showAlert('Success', 'Z-Reading printed successfully!');
      } else {
        // PDF fallback via system print dialog
        const pdfData = buildZReadingData();
        const paperWidth = getPaperWidth();
        await printZReadingPdf(pdfData, paperWidth);
      }
    } catch (error) {
      console.error('Print error:', error);
      showAlert('Print Error', error instanceof Error ? error.message : 'Failed to print');
    } finally {
      setIsPrinting(false);
    }
  };

  // Export Z-Reading to PDF
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfData = buildZReadingData();
      const paperWidth = getPaperWidth();
      await shareZReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Error', error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Email Z-Reading
  const handleEmail = async () => {
    setIsEmailing(true);
    try {
      const pdfData = buildZReadingData();
      const paperWidth = getPaperWidth();
      await emailZReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Email error:', error);
      showAlert('Email Error', error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsEmailing(false);
    }
  };

  // Build ZReadingPdfData from historical EOD record
  const buildHistoricalZReadingData = (eod: any): ZReadingPdfData => {
    return {
      businessName: businessInfo.name,
      businessAddress: businessInfo.address,
      tin: businessInfo.tin,
      date: new Date(eod.date + 'T00:00:00').toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      zReadingNumber: String(eod.id),
      cashierName: eod.cashier_name || 'Cashier',
      transaction_count: eod.transaction_count || 0,
      gross_sales: eod.gross_sales || 0,
      discount_amount: eod.discounts || 0,
      sales_returns: eod.sales_returns || 0,
      net_sales: eod.net_sales || 0,
      vat_sales: (eod.gross_sales || 0) / 1.12,
      vat_amount: (eod.gross_sales || 0) - ((eod.gross_sales || 0) / 1.12),
      vat_exempt_sales: 0,
      zero_rated_sales: 0,
      cash_sales: eod.cash_sales || 0,
      card_sales: eod.card_sales || 0,
      check_sales: eod.check_sales || 0,
      credit_sales: eod.credit_sales || 0,
      online_sales: eod.gcash_sales || 0,
      void_count: eod.void_count || 0,
      void_amount: eod.void_amount || 0,
      exchange_count: eod.exchange_count || 0,
      exchange_amount: eod.exchange_amount || 0,
      refund_count: eod.refund_count || 0,
      // AR Collections
      customer_payments_cash: eod.customer_payments_cash || 0,
      customer_payments_check: eod.customer_payments_check || 0,
      customer_payments_card: eod.customer_payments_card || 0,
      customer_payments_online: eod.customer_payments_online || 0,
      customer_payments_bank_transfer: eod.customer_payments_bank_transfer || 0,
      customer_payments_total: eod.customer_payments_received || 0,
      // Supplier Payments
      supplier_payments_made: eod.supplier_payments_made || 0,
      beginning_cash: eod.beginning_cash || 0,
      opening_fund: eod.opening_fund || 0,
      cash_in: eod.cash_in || 0,
      cash_out: eod.cash_out || 0,
      cash_fund: eod.cash_fund || 0,
      petty_cash: eod.petty_cash || 0,
      cash_refunds: eod.cash_refunds || 0,
      expected_cash: eod.expected_cash || 0,
      actual_cash: eod.actual_cash || 0,
      cash_variance: eod.cash_variance || 0,
    };
  };

  // Print historical Z-Reading
  const handleHistoryPrint = async (eod: any) => {
    if (Platform.OS === 'web') {
      showAlert('Not Available', 'Thermal printing is not available on web. Please use Export to PDF instead.');
      return;
    }

    const printerService = BluetoothPrinterService.getInstance();
    if (!printerService.isConnected()) {
      showAlert('Not Connected', 'Please connect to a Bluetooth printer in Settings > Printer Settings first.');
      return;
    }

    setIsHistoryPrinting(true);
    try {
      const settings = printerService.getSettings();
      const printerWidth = settings.printerWidth;

      const zReadingBuilder = buildZReading(
        {
          businessName: businessInfo.name,
          tin: businessInfo.tin,
          zReadingNumber: eod.id,
          date: new Date(eod.date),
          resetCounter: eod.id,
          beginningOR: '',
          endingOR: '',
          grossSales: eod.gross_sales || 0,
          regularDiscount: eod.discounts || 0,
          seniorDiscount: 0,
          voidAmount: eod.void_amount || 0,
          returnAmount: eod.sales_returns || 0,
          netSales: eod.net_sales || 0,
          vatableSales: (eod.gross_sales || 0) / 1.12,
          vatAmount: (eod.gross_sales || 0) - ((eod.gross_sales || 0) / 1.12),
          vatExemptSales: 0,
          zeroRatedSales: 0,
          transactionCount: eod.transaction_count || 0,
          cashierName: eod.cashier_name || 'Cashier',
          voidCount: eod.void_count || 0,
          exchangeCount: eod.exchange_count || 0,
          exchangeAmount: eod.exchange_amount || 0,
          refundCount: eod.refund_count || 0,
          refundAmount: eod.sales_returns || 0,
          // Cash Drawer
          beginningCash: eod.beginning_cash || 0,
          openingFund: eod.opening_fund || 0,
          cashIn: eod.cash_in || 0,
          cashOut: eod.cash_out || 0,
          cashSales: eod.cash_sales || 0,
          customerPaymentsCash: eod.customer_payments_cash || 0,
          customerPaymentsCheck: eod.customer_payments_check || 0,
          customerPaymentsCard: eod.customer_payments_card || 0,
          customerPaymentsOnline: eod.customer_payments_online || 0,
          customerPaymentsBankTransfer: eod.customer_payments_bank_transfer || 0,
          customerPaymentsTotal: eod.customer_payments_received || 0,
          supplierPaymentsMade: eod.supplier_payments_made || 0,
          cashFund: eod.cash_fund || 0,
          pettyCash: eod.petty_cash || 0,
          cashRefunds: eod.cash_refunds || 0,
          expectedCash: eod.expected_cash || 0,
          actualCash: eod.actual_cash || 0,
          cashVariance: (eod.actual_cash || 0) - (eod.expected_cash || 0),
        },
        printerWidth
      );

      await printerService.print(zReadingBuilder);
      showAlert('Success', 'Z-Reading printed successfully!');
    } catch (error) {
      console.error('Print error:', error);
      showAlert('Print Error', error instanceof Error ? error.message : 'Failed to print');
    } finally {
      setIsHistoryPrinting(false);
    }
  };

  // Export historical Z-Reading to PDF
  const handleHistoryExportPdf = async (eod: any) => {
    setIsHistoryExporting(true);
    try {
      const pdfData = buildHistoricalZReadingData(eod);
      const paperWidth = getPaperWidth();
      await shareZReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Error', error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsHistoryExporting(false);
    }
  };

  // Email historical Z-Reading
  const handleHistoryEmail = async (eod: any) => {
    setIsHistoryEmailing(true);
    try {
      const pdfData = buildHistoricalZReadingData(eod);
      const paperWidth = getPaperWidth();
      await emailZReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Email error:', error);
      showAlert('Email Error', error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsHistoryEmailing(false);
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
            date: targetDate,  // Use target date for closing unterminated sessions
            beginning_cash: beginningCashNum,
            gross_sales: daySummary.grossSales,
            discounts: daySummary.discounts,
            sales_returns: daySummary.salesReturns,
            net_sales: daySummary.netSales,
            cash_sales: daySummary.cashSales,
            credit_sales: daySummary.creditSales,
            gcash_sales: daySummary.gcashSales,
            card_sales: daySummary.cardSales,
            check_sales: daySummary.checkSales,
            other_sales: daySummary.otherSales,
            void_amount: daySummary.voidAmount,
            void_count: daySummary.voidCount,
            exchange_amount: daySummary.exchangeAmount,
            exchange_count: daySummary.exchangeCount,
            refund_count: daySummary.refundCount,
            transaction_count: daySummary.transactionCount,
            customer_payments_received: daySummary.customerPaymentsTotal,
            customer_payments_cash: daySummary.customerPaymentsCash,
            customer_payments_check: daySummary.customerPaymentsCheck,
            customer_payments_card: daySummary.customerPaymentsCard,
            customer_payments_online: daySummary.customerPaymentsOnline,
            customer_payments_bank_transfer: daySummary.customerPaymentsBankTransfer,
            supplier_payments_made: daySummary.supplierPaymentsTotal,
            opening_fund: daySummary.openingFund,
            cash_in: daySummary.cashIn,
            cash_out: daySummary.cashOut,
            petty_cash: daySummary.pettyCash,
            cash_refunds: totalCashRefundsOut,
            cash_fund: daySummary.cashFundAdded,
            expected_cash: expectedCash,
            actual_cash: totalCashCount,
            cash_variance: cashVariance,
            denomination_breakdown: denominations,
            next_day_beginning_cash: 0, // Each day starts fresh - cashier enters their own amount
            created_by: user?.id || 1,
            status: 'COMPLETED',
          };

          console.log('[EOD] Saving End of Day for date:', targetDate);
          const eodResult = await dbService.saveEndOfDay(eodData);
          console.log('[EOD] End of Day record saved with ID:', eodResult);

          // Generate Z-Reading for the target date (creates record in z_readings table)
          try {
            console.log('[EOD] Generating Z-Reading for date:', targetDate);
            const zReadingResult = await dbService.generateZReading(user?.id || 1, targetDate);
            console.log('[EOD] Z-Reading generated:', zReadingResult);
          } catch (zError: any) {
            // Z-Reading might already exist for this date, which is OK
            if (zError.message?.includes('already generated')) {
              console.log('[EOD] Z-Reading already exists for this date (OK)');
            } else {
              console.error('[EOD] Z-Reading generation error:', zError);
            }
          }

          // Auto-save X-Reading to pair with Z-Reading (BIR compliance)
          let xReadingFailed = false;
          try {
            console.log('[EOD] Auto-saving X-Reading to pair with Z-Reading');
            const xReadingId = await dbService.saveXReading(user?.id || 1, targetDate);
            console.log('[EOD] X-Reading auto-saved with ID:', xReadingId);
          } catch (xError: any) {
            console.error('[EOD] X-Reading auto-save error (non-fatal):', xError);
            xReadingFailed = true;
          }

          // Close ALL open shifts for this user (handles multiple stuck open shifts)
          if (user?.id) {
            console.log('[EOD] Closing all open shifts for user:', user.id);
            const closedCount = await dbService.closeAllOpenShifts(user.id, totalCashCount);
            console.log(`[EOD] Closed ${closedCount} shift(s) for user ${user.id}`);
          }

          // NOTE: Do NOT auto-fill beginning_cash for next shift
          // Each cashier enters their own beginning cash amount (given by owner)

          // Show completion dialog with print/export options
          setCompletionSummary({
            netSales: daySummary.netSales,
            variance: cashVariance,
            cashCounted: totalCashCount,
            xReadingFailed,
          });
          setShowCompletionDialog(true);
        } catch (error) {
          console.error('Error saving EOD:', error);
          showAlert('Error', 'Failed to save End of Day record');
        } finally {
          setSubmitting(false);
        }
      }
    );
  };

  const webContainerStyle = {};
  const webScrollStyle = {};

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Paragraph>Loading day summary...</Paragraph>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }, webContainerStyle]}>
      <ScrollView style={[styles.scrollView, webScrollStyle]} contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}>
        {/* Header */}
        <View style={styles.header}>
          <Title style={[styles.pageTitle, { fontSize: fs.h2 }]}>End of Day (Z-Reading)</Title>
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
              <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>EOD History</Title>
              <Paragraph style={styles.noteText}>Tap a record to view details and print/export.</Paragraph>
              {eodHistory.length === 0 ? (
                <Paragraph style={styles.emptyText}>No EOD records yet</Paragraph>
              ) : (
                eodHistory.slice(0, 20).map((eod, index) => (
                  <View key={eod.id || index}>
                    <TouchableOpacity
                      onPress={() => setSelectedHistoryItem(selectedHistoryItem?.id === eod.id ? null : eod)}
                    >
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
                        right={props => (
                          <List.Icon
                            {...props}
                            icon={selectedHistoryItem?.id === eod.id ? 'chevron-up' : 'chevron-down'}
                          />
                        )}
                      />
                    </TouchableOpacity>

                    {/* Expandable Details */}
                    {selectedHistoryItem?.id === eod.id && (
                      <View style={styles.historyDetails}>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Date:</Text>
                          <Text style={styles.historyDetailValue}>{eod.date}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Cashier:</Text>
                          <Text style={styles.historyDetailValue}>{eod.cashier_name || 'Unknown'}</Text>
                        </View>
                        <Divider style={styles.historyDivider} />
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Gross Sales:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.gross_sales || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Discounts:</Text>
                          <Text style={styles.historyDetailValueRed}>(₱{(eod.discounts || 0).toFixed(2)})</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Net Sales:</Text>
                          <Text style={styles.historyDetailValueBold}>₱{(eod.net_sales || 0).toFixed(2)}</Text>
                        </View>
                        <Divider style={styles.historyDivider} />
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Cash Sales:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.cash_sales || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Card Sales:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.card_sales || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>GCash/Online:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.gcash_sales || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Credit Sales:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.credit_sales || 0).toFixed(2)}</Text>
                        </View>
                        <Divider style={styles.historyDivider} />
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Transactions:</Text>
                          <Text style={styles.historyDetailValue}>{eod.transaction_count || 0}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Voids:</Text>
                          <Text style={styles.historyDetailValueRed}>{eod.void_count || 0} (₱{(eod.void_amount || 0).toFixed(2)})</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Exchanges:</Text>
                          <Text style={styles.historyDetailValueRed}>{eod.exchange_count || 0} (₱{(eod.exchange_amount || 0).toFixed(2)})</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Refunds:</Text>
                          <Text style={styles.historyDetailValueRed}>{eod.refund_count || 0} (₱{(eod.sales_returns || 0).toFixed(2)})</Text>
                        </View>
                        <Divider style={styles.historyDivider} />
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Beginning Cash:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.beginning_cash || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Expected Cash:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.expected_cash || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Actual Cash:</Text>
                          <Text style={styles.historyDetailValue}>₱{(eod.actual_cash || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.historyDetailRow}>
                          <Text style={styles.historyDetailLabel}>Variance:</Text>
                          <Text style={[
                            styles.historyDetailValueBold,
                            eod.cash_variance === 0 ? styles.varianceBalanced :
                            eod.cash_variance < 0 ? styles.varianceShort : styles.varianceOver
                          ]}>
                            {eod.cash_variance === 0 ? 'BALANCED' :
                             eod.cash_variance < 0 ? `SHORT ₱${Math.abs(eod.cash_variance).toFixed(2)}` :
                             `OVER ₱${eod.cash_variance.toFixed(2)}`}
                          </Text>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.historyActionRow}>
                          <TouchableOpacity
                            style={[styles.historyActionBtn, isHistoryPrinting && styles.actionBtnDisabled]}
                            onPress={() => handleHistoryPrint(eod)}
                            disabled={isHistoryPrinting || isHistoryExporting || isHistoryEmailing}
                          >
                            {isHistoryPrinting ? (
                              <ActivityIndicator size="small" color="#6200EE" />
                            ) : (
                              <>
                                <Text style={styles.actionBtnIcon}>🖨️</Text>
                                <Text style={styles.actionBtnText}>Print</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.historyActionBtn, isHistoryExporting && styles.actionBtnDisabled]}
                            onPress={() => handleHistoryExportPdf(eod)}
                            disabled={isHistoryPrinting || isHistoryExporting || isHistoryEmailing}
                          >
                            {isHistoryExporting ? (
                              <ActivityIndicator size="small" color="#6200EE" />
                            ) : (
                              <>
                                <Text style={styles.actionBtnIcon}>📄</Text>
                                <Text style={styles.actionBtnText}>PDF</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.historyActionBtn, isHistoryEmailing && styles.actionBtnDisabled]}
                            onPress={() => handleHistoryEmail(eod)}
                            disabled={isHistoryPrinting || isHistoryExporting || isHistoryEmailing}
                          >
                            {isHistoryEmailing ? (
                              <ActivityIndicator size="small" color="#6200EE" />
                            ) : (
                              <>
                                <Text style={styles.actionBtnIcon}>📧</Text>
                                <Text style={styles.actionBtnText}>Email</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

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
                    {new Date(targetDate + 'T00:00:00').toLocaleDateString('en-PH', {
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Beginning Cash on Hand</Title>
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Sales Summary</Title>
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
                <Paragraph style={styles.subHeader}>Voids / Exchanges / Refunds:</Paragraph>
                <DataTable>
                  <DataTable.Row>
                    <DataTable.Cell>Void ({daySummary.voidCount})</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.voidAmount.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>Exchange ({daySummary.exchangeCount})</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.exchangeAmount.toFixed(2)})</DataTable.Cell>
                  </DataTable.Row>
                  <DataTable.Row>
                    <DataTable.Cell>Refund ({daySummary.refundCount})</DataTable.Cell>
                    <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.salesReturns.toFixed(2)})</DataTable.Cell>
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>AR Collections (Customer Payments)</Title>
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Supplier Payments (Cash Out)</Title>
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
                  <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Sales Returns / Refunds</Title>
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Cash Breakdown Count</Title>
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
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>💵 Cash Drawer Accountability</Title>
                <Paragraph style={styles.noteText}>
                  Only CASH transactions are included. Record supplier cash payments as Petty Cash.
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
                  {daySummary.openingFund > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Add: Opening Fund</DataTable.Cell>
                      <DataTable.Cell numeric>₱{daySummary.openingFund.toFixed(2)}</DataTable.Cell>
                    </DataTable.Row>
                  )}
                  {daySummary.cashIn > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Add: Cash In</DataTable.Cell>
                      <DataTable.Cell numeric>₱{daySummary.cashIn.toFixed(2)}</DataTable.Cell>
                    </DataTable.Row>
                  )}
                  {totalCashRefundsOut > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Less: Cash Refunds</DataTable.Cell>
                      <DataTable.Cell numeric style={styles.deduction}>(₱{totalCashRefundsOut.toFixed(2)})</DataTable.Cell>
                    </DataTable.Row>
                  )}
                  {daySummary.cashOut > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Less: Cash Out</DataTable.Cell>
                      <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.cashOut.toFixed(2)})</DataTable.Cell>
                    </DataTable.Row>
                  )}
                  {daySummary.pettyCash > 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>Less: Petty Cash</DataTable.Cell>
                      <DataTable.Cell numeric style={styles.deduction}>(₱{daySummary.pettyCash.toFixed(2)})</DataTable.Cell>
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

            {/* Action Buttons - Print, Export, Email */}
            <Card style={styles.card}>
              <Card.Content>
                <Title style={[styles.sectionTitle, { fontSize: fs.h3 }]}>📤 Print / Export Z-Reading</Title>
                <Paragraph style={styles.noteText}>
                  You can print, export, or email the Z-Reading report. Select one or more options:
                </Paragraph>
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, isPrinting && styles.actionBtnDisabled]}
                    onPress={handlePrint}
                    disabled={isPrinting || isExporting || isEmailing}
                  >
                    {isPrinting ? (
                      <ActivityIndicator size="small" color="#6200EE" />
                    ) : (
                      <>
                        <Text style={styles.actionBtnIcon}>🖨️</Text>
                        <Text style={styles.actionBtnText}>Print</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, isExporting && styles.actionBtnDisabled]}
                    onPress={handleExportPdf}
                    disabled={isPrinting || isExporting || isEmailing}
                  >
                    {isExporting ? (
                      <ActivityIndicator size="small" color="#6200EE" />
                    ) : (
                      <>
                        <Text style={styles.actionBtnIcon}>📄</Text>
                        <Text style={styles.actionBtnText}>Export PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, isEmailing && styles.actionBtnDisabled]}
                    onPress={handleEmail}
                    disabled={isPrinting || isExporting || isEmailing}
                  >
                    {isEmailing ? (
                      <ActivityIndicator size="small" color="#6200EE" />
                    ) : (
                      <>
                        <Text style={styles.actionBtnIcon}>📧</Text>
                        <Text style={styles.actionBtnText}>Email</Text>
                      </>
                    )}
                  </TouchableOpacity>
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

      {/* Completion Dialog with Print/Export Options */}
      <Modal
        visible={showCompletionDialog}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.completionOverlay}>
          <View style={styles.completionDialog}>
            {/* Header */}
            <View style={styles.completionHeader}>
              <Text style={styles.completionHeaderIcon}>✅</Text>
              <Text style={styles.completionHeaderTitle}>End of Day Complete</Text>
            </View>

            {/* Summary */}
            <View style={styles.completionContent}>
              <Text style={styles.completionMessage}>
                Z-Reading saved successfully! Your shift has been closed.
              </Text>

              {completionSummary && (
                <View style={styles.completionSummary}>
                  <View style={styles.completionSummaryRow}>
                    <Text style={styles.completionSummaryLabel}>Net Sales:</Text>
                    <Text style={styles.completionSummaryValue}>₱{completionSummary.netSales.toFixed(2)}</Text>
                  </View>
                  <View style={styles.completionSummaryRow}>
                    <Text style={styles.completionSummaryLabel}>Cash Counted:</Text>
                    <Text style={styles.completionSummaryValue}>₱{completionSummary.cashCounted.toFixed(2)}</Text>
                  </View>
                  <View style={styles.completionSummaryRow}>
                    <Text style={styles.completionSummaryLabel}>Variance:</Text>
                    <Text style={[
                      styles.completionSummaryValue,
                      completionSummary.variance === 0 ? styles.varianceBalanced :
                      completionSummary.variance < 0 ? styles.varianceShort : styles.varianceOver
                    ]}>
                      {completionSummary.variance === 0 ? 'BALANCED' :
                       completionSummary.variance < 0 ? `SHORT ₱${Math.abs(completionSummary.variance).toFixed(2)}` :
                       `OVER ₱${completionSummary.variance.toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              )}

              {completionSummary?.xReadingFailed && (
                <Text style={{ color: '#E65100', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                  Warning: X-Reading auto-save failed. You may need to generate it manually.
                </Text>
              )}

              <Text style={styles.completionPrompt}>
                Would you like to print or export the Z-Reading?
              </Text>

              {/* Action Buttons */}
              <View style={styles.completionActions}>
                <TouchableOpacity
                  style={[styles.completionActionBtn, isPrinting && styles.actionBtnDisabled]}
                  onPress={handlePrint}
                  disabled={isPrinting || isExporting || isEmailing}
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color="#6200EE" />
                  ) : (
                    <>
                      <Text style={styles.completionActionIcon}>🖨️</Text>
                      <Text style={styles.completionActionText}>Print</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.completionActionBtn, isExporting && styles.actionBtnDisabled]}
                  onPress={handleExportPdf}
                  disabled={isPrinting || isExporting || isEmailing}
                >
                  {isExporting ? (
                    <ActivityIndicator size="small" color="#6200EE" />
                  ) : (
                    <>
                      <Text style={styles.completionActionIcon}>📄</Text>
                      <Text style={styles.completionActionText}>Export PDF</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.completionActionBtn, isEmailing && styles.actionBtnDisabled]}
                  onPress={handleEmail}
                  disabled={isPrinting || isExporting || isEmailing}
                >
                  {isEmailing ? (
                    <ActivityIndicator size="small" color="#6200EE" />
                  ) : (
                    <>
                      <Text style={styles.completionActionIcon}>📧</Text>
                      <Text style={styles.completionActionText}>Email</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.completionDoneBtn}
              onPress={() => {
                setShowCompletionDialog(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Dashboard' }],
                });
              }}
            >
              <Text style={styles.completionDoneBtnText}>Done - Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    flexGrow: 1,
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
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 90,
    elevation: 2,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6200EE',
  },
  historyDetails: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  historyDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyDetailLabel: {
    fontSize: 13,
    color: '#616161',
  },
  historyDetailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#212121',
  },
  historyDetailValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#212121',
  },
  historyDetailValueRed: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D32F2F',
  },
  historyDivider: {
    marginVertical: 8,
  },
  historyActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  historyActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 70,
  },
  varianceBalanced: {
    color: '#4CAF50',
  },
  varianceShort: {
    color: '#D32F2F',
  },
  varianceOver: {
    color: '#FF9800',
  },
  // Completion Dialog Styles
  completionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completionDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  completionHeader: {
    backgroundColor: '#4CAF50',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
  },
  completionHeaderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  completionHeaderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  completionContent: {
    padding: 20,
  },
  completionMessage: {
    fontSize: 15,
    color: '#424242',
    textAlign: 'center',
    marginBottom: 16,
  },
  completionSummary: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  completionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  completionSummaryLabel: {
    fontSize: 14,
    color: '#616161',
  },
  completionSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  completionPrompt: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 16,
  },
  completionActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  completionActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 90,
    elevation: 2,
  },
  completionActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  completionActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6200EE',
  },
  completionDoneBtn: {
    backgroundColor: '#6200EE',
    paddingVertical: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    alignItems: 'center',
  },
  completionDoneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
