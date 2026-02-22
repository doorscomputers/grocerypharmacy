import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  useTheme,
  Chip,
  Divider,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { getDatabase } from '../database/getDatabase';
import DateRangeFilter, { getDateRange, DatePreset } from '../components/DateRangeFilter';
import ReportActionsBar from '../components/ReportActionsBar';
import { ESCPOSBuilder } from '../utils/escpos';
import { buildZReading, PRINTER_WIDTH } from '../utils/escpos';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import {
  ZReadingPdfData,
  printZReadingPdf,
  shareZReadingPdf,
  emailZReadingPdf,
  formatPesoCurrency,
} from '../utils/ReceiptPdfService';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'ZReadingHistory'>;
};

export default function ZReadingHistoryScreen({ navigation }: Props) {
  const theme = useTheme();
  const { sp, fs, lo } = useResponsiveTheme();

  const [loading, setLoading] = useState(true);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [businessInfo, setBusinessInfo] = useState({ name: '', address: '', tin: '' });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const initialRange = getDateRange('this_month');
  const [startDate, setStartDate] = useState<Date | null>(initialRange.startDate);
  const [endDate, setEndDate] = useState<Date | null>(initialRange.endDate);
  const [selectedCashier, setSelectedCashier] = useState<number | null>(null);

  // Action states
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = getDatabase();
      const [records, userList] = await Promise.all([
        db.getEndOfDayRecords(500),
        db.getUsers(),
      ]);

      const nameSetting = await db.getSetting('business_name');
      const addressSetting = await db.getSetting('business_address');
      const tinSetting = await db.getSetting('business_tin');

      setAllRecords(records);
      setUsers(userList);
      setBusinessInfo({
        name: nameSetting || 'IgoroTech POS',
        address: addressSetting || '',
        tin: tinSetting || '',
      });
    } catch (error) {
      console.error('Error loading Z-Reading history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering
  const filteredRecords = useMemo(() => {
    return allRecords.filter((record) => {
      // Date filter
      if (startDate || endDate) {
        const recordDate = new Date(record.date + 'T00:00:00');
        if (startDate && recordDate < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) return false;
        if (endDate && recordDate > new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59)) return false;
      }
      // Cashier filter (EOD uses created_by)
      if (selectedCashier !== null && record.created_by !== selectedCashier) return false;
      return true;
    });
  }, [allRecords, startDate, endDate, selectedCashier]);

  const handleDateChange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    return formatPesoCurrency(value);
  };

  const getPaperWidth = (): '58mm' | '80mm' => {
    const printerService = BluetoothPrinterService.getInstance();
    const settings = printerService.getSettings();
    return settings.printerWidth === PRINTER_WIDTH.MM_80 ? '80mm' : '58mm';
  };

  // Build ZReadingPdfData from EOD record
  const buildPdfData = (eod: any): ZReadingPdfData => {
    return {
      businessName: businessInfo.name,
      businessAddress: businessInfo.address,
      tin: businessInfo.tin,
      date: formatDate(eod.date),
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

  // Per-record print
  const handleRecordPrint = async (eod: any) => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Thermal printing is not available on web. Please use Export to PDF instead.');
      return;
    }

    setIsPrinting(true);
    try {
      const printerService = BluetoothPrinterService.getInstance();
      if (printerService.isConnected()) {
        const settings = printerService.getSettings();
        const printerWidth = settings.printerWidth;
        const builder = buildZReading(
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
        await printerService.print(builder);
        Alert.alert('Success', 'Z-Reading printed successfully!');
      } else {
        const pdfData = buildPdfData(eod);
        const paperWidth = getPaperWidth();
        await printZReadingPdf(pdfData, paperWidth);
      }
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', error instanceof Error ? error.message : 'Failed to print');
    } finally {
      setIsPrinting(false);
    }
  };

  // Per-record PDF export
  const handleRecordPdf = async (eod: any) => {
    setIsExporting(true);
    try {
      const pdfData = buildPdfData(eod);
      const paperWidth = getPaperWidth();
      await shareZReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Per-record email
  const handleRecordEmail = async (eod: any) => {
    setIsEmailing(true);
    try {
      const pdfData = buildPdfData(eod);
      const paperWidth = getPaperWidth();
      await emailZReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Email error:', error);
      Alert.alert('Email Error', error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsEmailing(false);
    }
  };

  // Consolidated report builders for ReportActionsBar
  const buildConsolidatedPrintData = useCallback((printerWidth: number): ESCPOSBuilder => {
    const builder = new ESCPOSBuilder();
    builder.align('center').bold(true).println(businessInfo.name).bold(false);
    if (businessInfo.address) builder.println(businessInfo.address);
    if (businessInfo.tin) builder.println(`TIN: ${businessInfo.tin}`);
    builder.separator().align('center').bold(true).println('Z-READING HISTORY').bold(false).separator();
    builder.align('left').println(`Records: ${filteredRecords.length}`);
    if (startDate && endDate) {
      builder.println(`Period: ${startDate.toLocaleDateString('en-PH')} - ${endDate.toLocaleDateString('en-PH')}`);
    }
    builder.separator();

    let totalNet = 0;
    let totalGross = 0;
    let totalTxn = 0;

    filteredRecords.forEach((r) => {
      const cashier = r.cashier_name || 'Cashier';
      builder.leftRight(formatDate(r.date), cashier);
      builder.leftRight('Net Sales:', `P${(r.net_sales || 0).toFixed(2)}`);
      builder.leftRight('Variance:', `P${(r.cash_variance || 0).toFixed(2)}`);
      builder.separator();
      totalNet += r.net_sales || 0;
      totalGross += r.gross_sales || 0;
      totalTxn += r.transaction_count || 0;
    });

    builder.bold(true);
    builder.leftRight('TOTAL NET SALES:', `P${totalNet.toFixed(2)}`);
    builder.leftRight('TOTAL GROSS SALES:', `P${totalGross.toFixed(2)}`);
    builder.leftRight('TOTAL TRANSACTIONS:', String(totalTxn));
    builder.bold(false).separator().feed(3).cut();
    return builder;
  }, [filteredRecords, businessInfo, startDate, endDate]);

  const buildConsolidatedPdfHtml = useCallback((): string => {
    let totalNet = 0;
    let totalGross = 0;
    let totalTxn = 0;

    const rows = filteredRecords.map((r) => {
      totalNet += r.net_sales || 0;
      totalGross += r.gross_sales || 0;
      totalTxn += r.transaction_count || 0;
      const variance = r.cash_variance || 0;
      const varianceColor = variance === 0 ? '#333' : variance < 0 ? '#F44336' : '#4CAF50';
      return `<tr>
        <td>${formatDate(r.date)}</td>
        <td>${r.cashier_name || 'Cashier'}</td>
        <td style="text-align:right">${r.transaction_count || 0}</td>
        <td style="text-align:right">${formatCurrency(r.gross_sales || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.net_sales || 0)}</td>
        <td style="text-align:right;color:${varianceColor}">${formatCurrency(variance)}</td>
      </tr>`;
    }).join('');

    return `<html><head><style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
      h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
      h2 { text-align: center; font-size: 13px; color: #666; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
      th { background: #f5f5f5; font-weight: bold; }
      .totals td { font-weight: bold; background: #f0f0f0; }
      .info { margin-bottom: 8px; font-size: 11px; color: #555; }
    </style></head><body>
      <h1>${businessInfo.name}</h1>
      ${businessInfo.address ? `<h2>${businessInfo.address}</h2>` : ''}
      ${businessInfo.tin ? `<p class="info" style="text-align:center">TIN: ${businessInfo.tin}</p>` : ''}
      <h2>Z-Reading History Report</h2>
      <p class="info">Records: ${filteredRecords.length} | Period: ${startDate ? startDate.toLocaleDateString('en-PH') : 'All'} - ${endDate ? endDate.toLocaleDateString('en-PH') : 'All'}</p>
      <table>
        <thead><tr>
          <th>Date</th><th>Cashier</th><th>Txns</th><th>Gross Sales</th><th>Net Sales</th><th>Variance</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="totals">
          <td colspan="2">TOTALS</td>
          <td style="text-align:right">${totalTxn}</td>
          <td style="text-align:right">${formatCurrency(totalGross)}</td>
          <td style="text-align:right">${formatCurrency(totalNet)}</td>
          <td></td>
        </tr></tfoot>
      </table>
    </body></html>`;
  }, [filteredRecords, businessInfo, startDate, endDate]);

  // Unique cashiers from records (uses created_by)
  const cashierList = useMemo(() => {
    const map = new Map<number, string>();
    allRecords.forEach((r) => {
      if (r.created_by) {
        map.set(r.created_by, r.cashier_name || `User #${r.created_by}`);
      }
    });
    return Array.from(map.entries());
  }, [allRecords]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Paragraph style={{ marginTop: 12 }}>Loading Z-Reading history...</Paragraph>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Consolidated report actions */}
      <ReportActionsBar
        reportTitle="Z-Reading History"
        reportFileName="ZReading_History"
        onBuildPrintData={buildConsolidatedPrintData}
        onBuildPdfHtml={buildConsolidatedPdfHtml}
        disabled={filteredRecords.length === 0}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: lo.screenPadding }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Date Range Filter */}
        <DateRangeFilter onDateChange={handleDateChange} selectedPreset="this_month" />

        {/* Cashier Filter */}
        {cashierList.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <Chip
              selected={selectedCashier === null}
              onPress={() => setSelectedCashier(null)}
              style={[styles.chip, selectedCashier === null && { backgroundColor: theme.colors.primary }]}
              textStyle={selectedCashier === null ? { color: '#fff' } : undefined}
            >
              All Cashiers
            </Chip>
            {cashierList.map(([id, name]) => (
              <Chip
                key={id}
                selected={selectedCashier === id}
                onPress={() => setSelectedCashier(selectedCashier === id ? null : id)}
                style={[styles.chip, selectedCashier === id && { backgroundColor: theme.colors.primary }]}
                textStyle={selectedCashier === id ? { color: '#fff' } : undefined}
              >
                {name}
              </Chip>
            ))}
          </ScrollView>
        )}

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { fontSize: fs.h2 }]}>{filteredRecords.length}</Text>
              <Text style={styles.summaryLabel}>Records</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                {formatCurrency(filteredRecords.reduce((sum, r) => sum + (r.net_sales || 0), 0))}
              </Text>
              <Text style={styles.summaryLabel}>Total Net Sales</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Records */}
        {filteredRecords.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.centered}>
              <Title style={{ fontSize: 16, opacity: 0.6 }}>No Z-Reading records found</Title>
              <Paragraph style={{ opacity: 0.5 }}>Try adjusting your date range or cashier filter</Paragraph>
            </Card.Content>
          </Card>
        ) : (
          filteredRecords.map((eod) => {
            const isExpanded = expandedId === eod.id;
            const variance = eod.cash_variance || 0;
            const varianceColor = variance === 0 ? '#4CAF50' : variance < 0 ? '#F44336' : '#FF9800';
            return (
              <Card key={eod.id} style={styles.recordCard}>
                <TouchableOpacity
                  onPress={() => setExpandedId(isExpanded ? null : eod.id)}
                  activeOpacity={0.7}
                >
                  <Card.Content style={styles.recordHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordDate}>{formatDate(eod.date)}</Text>
                      <Text style={styles.recordTime}>{eod.cashier_name || 'Cashier'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.recordAmount}>{formatCurrency(eod.net_sales || 0)}</Text>
                      <Text style={[styles.varianceText, { color: varianceColor }]}>
                        {variance === 0 ? 'Balanced' : variance < 0 ? `Short ${formatCurrency(Math.abs(variance))}` : `Over ${formatCurrency(variance)}`}
                      </Text>
                      <Text style={styles.recordChevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                  </Card.Content>
                </TouchableOpacity>

                {isExpanded && (
                  <Card.Content style={styles.expandedContent}>
                    <Divider style={{ marginBottom: 8 }} />

                    {/* Sales Summary */}
                    <Text style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Sales Summary</Text>
                    <DetailRow label="Transactions" value={String(eod.transaction_count || 0)} />
                    <DetailRow label="Gross Sales" value={formatCurrency(eod.gross_sales || 0)} />
                    <DetailRow label="Discounts" value={`(${formatCurrency(eod.discounts || 0)})`} valueColor="#F44336" />
                    <DetailRow label="Sales Returns" value={`(${formatCurrency(eod.sales_returns || 0)})`} valueColor="#F44336" />
                    <DetailRow label="Net Sales" value={formatCurrency(eod.net_sales || 0)} bold />

                    {/* Voids / Exchanges / Refunds */}
                    <Text style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Adjustments</Text>
                    <DetailRow label="Voids" value={`${eod.void_count || 0} (${formatCurrency(eod.void_amount || 0)})`} valueColor="#F44336" />
                    <DetailRow label="Exchanges" value={`${eod.exchange_count || 0} (${formatCurrency(eod.exchange_amount || 0)})`} valueColor="#F44336" />
                    <DetailRow label="Refunds" value={`${eod.refund_count || 0}`} valueColor="#F44336" />

                    {/* Payment Methods */}
                    <Text style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Payment Methods</Text>
                    <DetailRow label="Cash" value={formatCurrency(eod.cash_sales || 0)} />
                    <DetailRow label="Card" value={formatCurrency(eod.card_sales || 0)} />
                    <DetailRow label="Check" value={formatCurrency(eod.check_sales || 0)} />
                    <DetailRow label="GCash/Online" value={formatCurrency(eod.gcash_sales || 0)} />
                    <DetailRow label="Credit" value={formatCurrency(eod.credit_sales || 0)} />

                    {/* AR Collections */}
                    {(eod.customer_payments_received || 0) > 0 && (
                      <>
                        <Text style={[styles.sectionTitle, { fontSize: fs.h3 }]}>AR Collections</Text>
                        <DetailRow label="Cash" value={formatCurrency(eod.customer_payments_cash || 0)} />
                        <DetailRow label="Check" value={formatCurrency(eod.customer_payments_check || 0)} />
                        <DetailRow label="Card" value={formatCurrency(eod.customer_payments_card || 0)} />
                        <DetailRow label="GCash/Online" value={formatCurrency(eod.customer_payments_online || 0)} />
                        <DetailRow label="Bank Transfer" value={formatCurrency(eod.customer_payments_bank_transfer || 0)} />
                        <DetailRow label="Total Collections" value={formatCurrency(eod.customer_payments_received || 0)} bold />
                      </>
                    )}

                    {/* Supplier Payments */}
                    {(eod.supplier_payments_made || 0) > 0 && (
                      <>
                        <Text style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Supplier Payments</Text>
                        <DetailRow label="Total Payments Made" value={`(${formatCurrency(eod.supplier_payments_made || 0)})`} valueColor="#F44336" />
                      </>
                    )}

                    {/* Cash Drawer */}
                    <Text style={[styles.sectionTitle, { fontSize: fs.h3 }]}>Cash Drawer</Text>
                    <DetailRow label="Beginning Cash" value={formatCurrency(eod.beginning_cash || 0)} />
                    {(eod.opening_fund || 0) > 0 && <DetailRow label="Opening Fund" value={formatCurrency(eod.opening_fund || 0)} />}
                    {(eod.cash_in || 0) > 0 && <DetailRow label="Cash In" value={formatCurrency(eod.cash_in || 0)} />}
                    <DetailRow label="Cash Sales" value={formatCurrency(eod.cash_sales || 0)} />
                    {(eod.customer_payments_cash || 0) > 0 && <DetailRow label="AR Collections (Cash)" value={formatCurrency(eod.customer_payments_cash || 0)} />}
                    {(eod.cash_out || 0) > 0 && <DetailRow label="Cash Out" value={`(${formatCurrency(eod.cash_out || 0)})`} valueColor="#F44336" />}
                    {(eod.petty_cash || 0) > 0 && <DetailRow label="Petty Cash" value={`(${formatCurrency(eod.petty_cash || 0)})`} valueColor="#F44336" />}
                    {(eod.cash_refunds || 0) > 0 && <DetailRow label="Cash Refunds" value={`(${formatCurrency(eod.cash_refunds || 0)})`} valueColor="#F44336" />}
                    <DetailRow label="Expected Cash" value={formatCurrency(eod.expected_cash || 0)} />
                    <DetailRow label="Actual Cash" value={formatCurrency(eod.actual_cash || 0)} />
                    <DetailRow
                      label="Variance"
                      value={variance === 0 ? 'Balanced' : `${variance < 0 ? 'Short' : 'Over'} ${formatCurrency(Math.abs(variance))}`}
                      valueColor={varianceColor}
                      bold
                    />

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, isPrinting && styles.actionBtnDisabled]}
                        onPress={() => handleRecordPrint(eod)}
                        disabled={isPrinting || isExporting || isEmailing}
                      >
                        {isPrinting ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <>
                            <Text style={styles.actionIcon}>🖨️</Text>
                            <Text style={styles.actionText}>Print</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, isExporting && styles.actionBtnDisabled]}
                        onPress={() => handleRecordPdf(eod)}
                        disabled={isPrinting || isExporting || isEmailing}
                      >
                        {isExporting ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <>
                            <Text style={styles.actionIcon}>📄</Text>
                            <Text style={styles.actionText}>PDF</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, isEmailing && styles.actionBtnDisabled]}
                        onPress={() => handleRecordEmail(eod)}
                        disabled={isPrinting || isExporting || isEmailing}
                      >
                        {isEmailing ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <>
                            <Text style={styles.actionIcon}>📧</Text>
                            <Text style={styles.actionText}>Email</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </Card.Content>
                )}
              </Card>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// Detail row helper
function DetailRow({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={[styles.detailValue, bold && { fontWeight: 'bold' }, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 12,
    maxHeight: 40,
  },
  chip: {
    marginRight: 8,
  },
  summaryCard: {
    marginBottom: 12,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyCard: {
    marginTop: 20,
    padding: 20,
  },
  recordCard: {
    marginBottom: 8,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  recordTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  recordAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  varianceText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  recordChevron: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  expandedContent: {
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
});
