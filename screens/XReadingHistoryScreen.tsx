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
import { buildXReading, PRINTER_WIDTH } from '../utils/escpos';
import BluetoothPrinterService from '../utils/BluetoothPrinterService';
import {
  XReadingPdfData,
  printXReadingPdf,
  shareXReadingPdf,
  emailXReadingPdf,
  formatPesoCurrency,
} from '../utils/ReceiptPdfService';
import { useResponsiveTheme } from '../utils/responsive';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'XReadingHistory'>;
};

export default function XReadingHistoryScreen({ navigation }: Props) {
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
  const [selectedCashier, setSelectedCashier] = useState<number | null>(null); // null = all

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
        db.getXReadingHistory(500),
        db.getUsers(),
      ]);

      // Load business info
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
      console.error('Error loading X-Reading history:', error);
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
      // Cashier filter
      if (selectedCashier !== null && record.cashier_id !== selectedCashier) return false;
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

  // Get paper width
  const getPaperWidth = (): '58mm' | '80mm' => {
    const printerService = BluetoothPrinterService.getInstance();
    const settings = printerService.getSettings();
    return settings.printerWidth === PRINTER_WIDTH.MM_80 ? '80mm' : '58mm';
  };

  // Build XReadingPdfData from a record
  const buildPdfData = (record: any): XReadingPdfData => {
    return {
      businessName: businessInfo.name,
      businessAddress: businessInfo.address,
      tin: businessInfo.tin,
      date: formatDate(record.date),
      time: record.time || '',
      cashierName: record.cashier_name || record.cashier_username || 'Cashier',
      transaction_count: record.transaction_count || 0,
      gross_sales: record.gross_sales || 0,
      discount_amount: record.discount_amount || 0,
      refund_amount: record.refund_amount || 0,
      refund_count: record.refund_count || 0,
      net_sales: record.net_sales || 0,
      vat_sales: record.vat_sales || 0,
      vat_amount: record.vat_amount || 0,
      vat_exempt_sales: record.vat_exempt_sales || 0,
      zero_rated_sales: record.zero_rated_sales || 0,
      cash_sales: record.cash_sales || 0,
      card_sales: record.card_sales || 0,
      check_sales: record.check_sales || 0,
      online_sales: record.online_sales || 0,
      credit_sales: record.credit_sales || 0,
      void_count: record.void_count || 0,
      void_amount: record.void_amount || 0,
      exchange_count: record.exchange_count || 0,
      exchange_amount: record.exchange_amount || 0,
      beginning_cash: record.beginning_cash || 0,
      opening_fund: record.opening_fund || 0,
      cash_in: record.cash_in || 0,
      cash_out: record.cash_out || 0,
      cash_fund: record.cash_fund || 0,
      petty_cash: record.petty_cash || 0,
      cash_refunds: record.cash_refunds || 0,
      customer_payments_cash: record.customer_payments_cash || 0,
      customer_payments_check: record.customer_payments_check || 0,
      customer_payments_card: record.customer_payments_card || 0,
      customer_payments_online: record.customer_payments_online || 0,
      customer_payments_bank_transfer: record.customer_payments_bank_transfer || 0,
      customer_payments_total: record.customer_payments_total || 0,
      expected_cash: record.expected_cash || 0,
    };
  };

  // Per-record print
  const handleRecordPrint = async (record: any) => {
    setIsPrinting(true);
    try {
      const printerService = BluetoothPrinterService.getInstance();
      if (printerService.isConnected()) {
        const settings = printerService.getSettings();
        const printerWidth = settings.printerWidth;
        const builder = buildXReading(
          {
            businessName: businessInfo.name,
            businessAddress: businessInfo.address,
            tin: businessInfo.tin,
            cashierName: record.cashier_name || record.cashier_username || 'Cashier',
            date: formatDate(record.date),
            time: record.time || '',
            transactionCount: record.transaction_count || 0,
            grossSales: record.gross_sales || 0,
            discounts: record.discount_amount || 0,
            refundAmount: record.refund_amount || 0,
            netSales: record.net_sales || 0,
            vatSales: record.vat_sales || 0,
            vatAmount: record.vat_amount || 0,
            vatExemptSales: record.vat_exempt_sales || 0,
            zeroRatedSales: record.zero_rated_sales || 0,
            cashSales: record.cash_sales || 0,
            cardSales: record.card_sales || 0,
            checkSales: record.check_sales || 0,
            onlineSales: record.online_sales || 0,
            creditSales: record.credit_sales || 0,
            voidCount: record.void_count || 0,
            voidAmount: record.void_amount || 0,
            exchangeCount: record.exchange_count || 0,
            exchangeAmount: record.exchange_amount || 0,
            refundCount: record.refund_count || 0,
            customerPaymentsCash: record.customer_payments_cash || 0,
            customerPaymentsCheck: record.customer_payments_check || 0,
            customerPaymentsCard: record.customer_payments_card || 0,
            customerPaymentsOnline: record.customer_payments_online || 0,
            customerPaymentsBankTransfer: record.customer_payments_bank_transfer || 0,
            customerPaymentsTotal: record.customer_payments_total || 0,
            beginningCash: record.beginning_cash || 0,
            openingFund: record.opening_fund || 0,
            cashIn: record.cash_in || 0,
            cashOut: record.cash_out || 0,
            pettyCash: record.petty_cash || 0,
            cashRefunds: record.cash_refunds || 0,
            expectedCash: record.expected_cash || 0,
          },
          printerWidth
        );
        await printerService.print(builder);
        Alert.alert('Success', 'X-Reading printed successfully!');
      } else {
        const pdfData = buildPdfData(record);
        const paperWidth = getPaperWidth();
        await printXReadingPdf(pdfData, paperWidth);
      }
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', error instanceof Error ? error.message : 'Failed to print');
    } finally {
      setIsPrinting(false);
    }
  };

  // Per-record PDF export
  const handleRecordPdf = async (record: any) => {
    setIsExporting(true);
    try {
      const pdfData = buildPdfData(record);
      const paperWidth = getPaperWidth();
      await shareXReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Per-record email
  const handleRecordEmail = async (record: any) => {
    setIsEmailing(true);
    try {
      const pdfData = buildPdfData(record);
      const paperWidth = getPaperWidth();
      await emailXReadingPdf(pdfData, paperWidth);
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
    builder.separator().align('center').bold(true).println('X-READING HISTORY').bold(false).separator();
    builder.align('left').println(`Records: ${filteredRecords.length}`);
    if (startDate && endDate) {
      builder.println(`Period: ${startDate.toLocaleDateString('en-PH')} - ${endDate.toLocaleDateString('en-PH')}`);
    }
    builder.separator();

    let totalNet = 0;
    let totalGross = 0;
    let totalTxn = 0;

    filteredRecords.forEach((r) => {
      const cashier = r.cashier_name || r.cashier_username || 'Cashier';
      builder.leftRight(formatDate(r.date), r.time || '');
      builder.leftRight(`Cashier: ${cashier}`, '');
      builder.leftRight('Net Sales:', `P${(r.net_sales || 0).toFixed(2)}`);
      builder.leftRight('Txn Count:', String(r.transaction_count || 0));
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
      return `<tr>
        <td>${formatDate(r.date)}</td>
        <td>${r.time || ''}</td>
        <td>${r.cashier_name || r.cashier_username || 'Cashier'}</td>
        <td style="text-align:right">${r.transaction_count || 0}</td>
        <td style="text-align:right">${formatCurrency(r.gross_sales || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.discount_amount || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.net_sales || 0)}</td>
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
      <h2>X-Reading History Report</h2>
      <p class="info">Records: ${filteredRecords.length} | Period: ${startDate ? startDate.toLocaleDateString('en-PH') : 'All'} - ${endDate ? endDate.toLocaleDateString('en-PH') : 'All'}</p>
      <table>
        <thead><tr>
          <th>Date</th><th>Time</th><th>Cashier</th><th>Txns</th><th>Gross Sales</th><th>Discounts</th><th>Net Sales</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="totals">
          <td colspan="3">TOTALS</td>
          <td style="text-align:right">${totalTxn}</td>
          <td style="text-align:right">${formatCurrency(totalGross)}</td>
          <td></td>
          <td style="text-align:right">${formatCurrency(totalNet)}</td>
        </tr></tfoot>
      </table>
    </body></html>`;
  }, [filteredRecords, businessInfo, startDate, endDate]);

  // Unique cashiers from records
  const cashierList = useMemo(() => {
    const map = new Map<number, string>();
    allRecords.forEach((r) => {
      if (r.cashier_id) {
        map.set(r.cashier_id, r.cashier_name || r.cashier_username || `User #${r.cashier_id}`);
      }
    });
    return Array.from(map.entries()); // [[id, name], ...]
  }, [allRecords]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Paragraph style={{ marginTop: 12 }}>Loading X-Reading history...</Paragraph>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Consolidated report actions */}
      <ReportActionsBar
        reportTitle="X-Reading History"
        reportFileName="XReading_History"
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
              <Title style={{ fontSize: 16, opacity: 0.6 }}>No X-Reading records found</Title>
              <Paragraph style={{ opacity: 0.5 }}>Try adjusting your date range or cashier filter</Paragraph>
            </Card.Content>
          </Card>
        ) : (
          filteredRecords.map((record) => {
            const isExpanded = expandedId === record.id;
            return (
              <Card key={record.id} style={styles.recordCard}>
                <TouchableOpacity
                  onPress={() => setExpandedId(isExpanded ? null : record.id)}
                  activeOpacity={0.7}
                >
                  <Card.Content style={styles.recordHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                      <Text style={styles.recordTime}>{record.time || ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.recordAmount}>{formatCurrency(record.net_sales || 0)}</Text>
                      <Text style={styles.recordChevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                  </Card.Content>
                </TouchableOpacity>

                {isExpanded && (
                  <Card.Content style={styles.expandedContent}>
                    <Divider style={{ marginBottom: 8 }} />
                    <DetailRow label="Cashier" value={record.cashier_name || record.cashier_username || 'Unknown'} />
                    <DetailRow label="Transactions" value={String(record.transaction_count || 0)} />
                    <DetailRow label="Gross Sales" value={formatCurrency(record.gross_sales || 0)} />
                    <DetailRow label="Discounts" value={`(${formatCurrency(record.discount_amount || 0)})`} valueColor="#F44336" />
                    <DetailRow label="Net Sales" value={formatCurrency(record.net_sales || 0)} bold />
                    <DetailRow label="Voids" value={`${record.void_count || 0} (${formatCurrency(record.void_amount || 0)})`} valueColor="#F44336" />
                    <DetailRow label="Exchanges" value={`${record.exchange_count || 0} (${formatCurrency(record.exchange_amount || 0)})`} valueColor="#F44336" />
                    <DetailRow label="Refunds" value={`${record.refund_count || 0} (${formatCurrency(record.refund_amount || 0)})`} valueColor="#F44336" />

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, isPrinting && styles.actionBtnDisabled]}
                        onPress={() => handleRecordPrint(record)}
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
                        onPress={() => handleRecordPdf(record)}
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
                        onPress={() => handleRecordEmail(record)}
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
  recordChevron: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  expandedContent: {
    paddingTop: 0,
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
