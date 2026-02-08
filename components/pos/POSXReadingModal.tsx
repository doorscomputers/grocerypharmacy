import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { DatabaseService } from '../../database/DatabaseService';
import BluetoothPrinterService from '../../utils/BluetoothPrinterService';
import { buildXReading, PRINTER_WIDTH } from '../../utils/escpos';
import {
  XReadingPdfData,
  shareXReadingPdf,
  emailXReadingPdf,
} from '../../utils/ReceiptPdfService';

interface POSXReadingModalProps {
  visible: boolean;
  onClose: () => void;
  cashierId: number;
  targetDate?: string;  // Optional date for viewing unterminated session data
}

interface XReadingData {
  date: string;
  time: string;
  transaction_count: number;
  gross_sales: number;
  vat_sales: number;
  vat_amount: number;
  vat_exempt_sales: number;
  zero_rated_sales: number;
  discount_amount: number;
  void_amount: number;
  void_count: number;
  refund_amount: number;
  net_sales: number;
  cash_sales: number;
  card_sales: number;
  check_sales: number;
  credit_sales: number;
  beginning_cash: number;
  cash_fund: number;
  petty_cash: number;
  expected_cash: number;
}

export default function POSXReadingModal({
  visible,
  onClose,
  cashierId,
  targetDate,
}: POSXReadingModalProps) {
  const [data, setData] = useState<XReadingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<{
    name: string;
    address: string;
    tin: string;
  }>({ name: '', address: '', tin: '' });
  const [cashierName, setCashierName] = useState<string>('');

  // History tab states
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryPrinting, setIsHistoryPrinting] = useState(false);
  const [isHistoryExporting, setIsHistoryExporting] = useState(false);
  const [isHistoryEmailing, setIsHistoryEmailing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAllData();
      setShowHistory(false);
      setSelectedHistoryItem(null);
    }
  }, [visible]);

  useEffect(() => {
    if (showHistory && visible) {
      loadHistoryData();
    }
  }, [showHistory, visible]);

  const loadHistoryData = async () => {
    setIsHistoryLoading(true);
    try {
      const db = DatabaseService.getInstance();
      const history = await db.getXReadingHistory(30);
      setHistoryData(history);
    } catch (error) {
      console.error('Error loading X-Reading history:', error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const db = DatabaseService.getInstance();

      // Check if database is ready before loading
      if (!db.isReady()) {
        Alert.alert('Error', 'Database not ready. Please restart the app.');
        setIsLoading(false);
        return;
      }

      // Load all data in parallel
      await Promise.all([
        loadXReadingData(),
        loadBusinessInfo(),
        loadCashierName(),
      ]);
    } catch (error) {
      console.error('Error loading X-Reading data:', error);
      Alert.alert('Error', 'Failed to load X-Reading data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBusinessInfo = async () => {
    try {
      const db = DatabaseService.getInstance();
      const [name, address, tin] = await Promise.all([
        db.getSetting('company_name'),
        db.getSetting('company_address'),
        db.getSetting('company_tin'),
      ]);
      setBusinessInfo({
        name: name || 'Store',
        address: address || '',
        tin: tin || '',
      });
    } catch (error) {
      console.error('Error loading business info:', error);
      // Error is handled by loadAllData()
    }
  };

  const loadCashierName = async () => {
    try {
      const db = DatabaseService.getInstance();
      const user = await db.getUserById(cashierId);
      if (user) {
        setCashierName(user.full_name || user.username);
      }
    } catch (error) {
      console.error('Error loading cashier name:', error);
      // Error is handled by loadAllData()
    }
  };

  const loadXReadingData = async () => {
    try {
      const db = DatabaseService.getInstance();

      // If targetDate is provided (from unterminated session), use it directly
      // Filter by cashierId to only show this cashier's transactions
      if (targetDate) {
        const xReadingData = await db.getXReadingData(targetDate, undefined, cashierId);
        setData(xReadingData);
        return;
      }

      // Otherwise, get current shift's start_time to filter data by shift
      let shiftStartTime: string | undefined;
      const currentShift = await db.getCurrentShift(cashierId);
      if (currentShift) {
        shiftStartTime = currentShift.start_time;
      }

      // Pass shift start time AND cashierId to get only this cashier's shift data
      const xReadingData = await db.getXReadingData(undefined, shiftStartTime, cashierId);
      setData(xReadingData);
    } catch (error) {
      console.error('Error loading X-Reading data:', error);
      // Error is handled by loadAllData()
    }
  };

  const handleSaveXReading = async () => {
    setIsSaving(true);
    try {
      const db = DatabaseService.getInstance();
      await db.saveXReading(cashierId);
      Alert.alert('Success', 'X-Reading saved successfully');
    } catch (error) {
      console.error('Error saving X-Reading:', error);
      Alert.alert('Error', 'Failed to save X-Reading');
    } finally {
      setIsSaving(false);
    }
  };

  // Get paper width setting
  const getPaperWidth = (): '58mm' | '80mm' => {
    const printerService = BluetoothPrinterService.getInstance();
    const settings = printerService.getSettings();
    return settings.printerWidth === PRINTER_WIDTH.MM_80 ? '80mm' : '58mm';
  };

  // Build XReadingPdfData from current data
  const buildPdfData = (): XReadingPdfData | null => {
    if (!data) return null;
    return {
      businessName: businessInfo.name,
      businessAddress: businessInfo.address,
      tin: businessInfo.tin,
      date: formatDate(data.date),
      time: data.time,
      cashierName: cashierName,
      transaction_count: data.transaction_count,
      gross_sales: data.gross_sales,
      discount_amount: data.discount_amount,
      refund_amount: data.refund_amount,
      net_sales: data.net_sales,
      vat_sales: data.vat_sales,
      vat_amount: data.vat_amount,
      vat_exempt_sales: data.vat_exempt_sales,
      zero_rated_sales: data.zero_rated_sales,
      cash_sales: data.cash_sales,
      card_sales: data.card_sales,
      check_sales: data.check_sales,
      credit_sales: data.credit_sales,
      void_count: data.void_count,
      void_amount: data.void_amount,
      beginning_cash: data.beginning_cash,
      cash_fund: data.cash_fund,
      petty_cash: data.petty_cash,
      expected_cash: data.expected_cash,
    };
  };

  // Print to thermal printer
  const handlePrint = async () => {
    if (!data) return;

    // Check if BLE is available (not on web)
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Thermal printing is not available on web. Please use Export to PDF instead.');
      return;
    }

    const printerService = BluetoothPrinterService.getInstance();
    if (!printerService.isConnected()) {
      Alert.alert('Not Connected', 'Please connect to a Bluetooth printer in Settings > Printer Settings first.');
      return;
    }

    setIsPrinting(true);
    try {
      const settings = printerService.getSettings();
      const printerWidth = settings.printerWidth;

      const xReadingBuilder = buildXReading(
        {
          businessName: businessInfo.name,
          tin: businessInfo.tin,
          readingNumber: 0, // X-Reading doesn't track number like Z-Reading
          cashierName: cashierName || 'Cashier',
          startTime: new Date(),
          endTime: new Date(),
          transactionCount: data.transaction_count,
          grossSales: data.gross_sales,
          netSales: data.net_sales,
          vatAmount: data.vat_amount,
          discounts: data.discount_amount,
          voidCount: data.void_count,
          voidAmount: data.void_amount,
        },
        printerWidth
      );

      await printerService.print(xReadingBuilder);
      Alert.alert('Success', 'X-Reading printed successfully!');
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', error instanceof Error ? error.message : 'Failed to print');
    } finally {
      setIsPrinting(false);
    }
  };

  // Export to PDF and share
  const handleExportPdf = async () => {
    if (!data) return;

    setIsExporting(true);
    try {
      const pdfData = buildPdfData();
      if (!pdfData) throw new Error('No data available');

      const paperWidth = getPaperWidth();
      await shareXReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Send via email
  const handleEmail = async () => {
    if (!data) return;

    setIsEmailing(true);
    try {
      const pdfData = buildPdfData();
      if (!pdfData) throw new Error('No data available');

      const paperWidth = getPaperWidth();
      await emailXReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Email error:', error);
      Alert.alert('Email Error', error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsEmailing(false);
    }
  };

  // Build XReadingPdfData from historical record
  const buildHistoryPdfData = (record: any): XReadingPdfData => {
    return {
      businessName: businessInfo.name,
      businessAddress: businessInfo.address,
      tin: businessInfo.tin,
      date: formatDate(record.date),
      time: record.time,
      cashierName: record.cashier_name || record.cashier_username || 'Cashier',
      transaction_count: record.transaction_count || 0,
      gross_sales: record.gross_sales || 0,
      discount_amount: record.discount_amount || 0,
      refund_amount: record.refund_amount || 0,
      net_sales: record.net_sales || 0,
      vat_sales: record.vat_sales || 0,
      vat_amount: record.vat_amount || 0,
      vat_exempt_sales: record.vat_exempt_sales || 0,
      zero_rated_sales: record.zero_rated_sales || 0,
      cash_sales: record.cash_sales || 0,
      card_sales: record.card_sales || 0,
      check_sales: record.check_sales || 0,
      credit_sales: record.credit_sales || 0,
      void_count: record.void_count || 0,
      void_amount: record.void_amount || 0,
      beginning_cash: record.beginning_cash || 0,
      cash_fund: record.cash_fund || 0,
      petty_cash: record.petty_cash || 0,
      expected_cash: record.expected_cash || 0,
    };
  };

  // Print historical X-Reading
  const handleHistoryPrint = async (record: any) => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Thermal printing is not available on web. Please use Export to PDF instead.');
      return;
    }

    const printerService = BluetoothPrinterService.getInstance();
    if (!printerService.isConnected()) {
      Alert.alert('Not Connected', 'Please connect to a Bluetooth printer in Settings > Printer Settings first.');
      return;
    }

    setIsHistoryPrinting(true);
    try {
      const settings = printerService.getSettings();
      const printerWidth = settings.printerWidth;

      const xReadingBuilder = buildXReading(
        {
          businessName: businessInfo.name,
          tin: businessInfo.tin,
          readingNumber: record.id || 0,
          cashierName: record.cashier_name || record.cashier_username || 'Cashier',
          startTime: new Date(record.date),
          endTime: new Date(record.date),
          transactionCount: record.transaction_count || 0,
          grossSales: record.gross_sales || 0,
          netSales: record.net_sales || 0,
          vatAmount: record.vat_amount || 0,
          discounts: record.discount_amount || 0,
          voidCount: record.void_count || 0,
          voidAmount: record.void_amount || 0,
        },
        printerWidth
      );

      await printerService.print(xReadingBuilder);
      Alert.alert('Success', 'X-Reading printed successfully!');
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', error instanceof Error ? error.message : 'Failed to print');
    } finally {
      setIsHistoryPrinting(false);
    }
  };

  // Export historical X-Reading to PDF
  const handleHistoryExportPdf = async (record: any) => {
    setIsHistoryExporting(true);
    try {
      const pdfData = buildHistoryPdfData(record);
      const paperWidth = getPaperWidth();
      await shareXReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsHistoryExporting(false);
    }
  };

  // Email historical X-Reading
  const handleHistoryEmail = async (record: any) => {
    setIsHistoryEmailing(true);
    try {
      const pdfData = buildHistoryPdfData(record);
      const paperWidth = getPaperWidth();
      await emailXReadingPdf(pdfData, paperWidth);
    } catch (error) {
      console.error('Email error:', error);
      Alert.alert('Email Error', error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsHistoryEmailing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>X-Reading</Text>
              <Text style={styles.headerSubtitle}>{showHistory ? 'History' : 'Mid-Day Inquiry Report'}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.historyToggle, showHistory && styles.historyToggleActive]}
                onPress={() => {
                  setShowHistory(!showHistory);
                  setSelectedHistoryItem(null);
                }}
              >
                <Text style={[styles.historyToggleText, showHistory && styles.historyToggleTextActive]}>
                  {showHistory ? 'Current' : 'History'}
                </Text>
              </TouchableOpacity>
              <IconButton icon="close" size={24} iconColor="#FFFFFF" onPress={onClose} />
            </View>
          </View>

          {showHistory ? (
            // History View
            isHistoryLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6200EE" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : (
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {historyData.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No X-Reading history yet</Text>
                    <Text style={styles.emptySubtext}>Save an X-Reading to see it here</Text>
                  </View>
                ) : (
                  historyData.map((record, index) => (
                    <View key={record.id || index}>
                      <TouchableOpacity
                        style={styles.historyItem}
                        onPress={() => setSelectedHistoryItem(
                          selectedHistoryItem?.id === record.id ? null : record
                        )}
                      >
                        <View style={styles.historyItemHeader}>
                          <View>
                            <Text style={styles.historyItemDate}>{formatDate(record.date)}</Text>
                            <Text style={styles.historyItemTime}>{record.time}</Text>
                          </View>
                          <View style={styles.historyItemRight}>
                            <Text style={styles.historyItemAmount}>{formatCurrency(record.net_sales || 0)}</Text>
                            <Text style={styles.historyItemChevron}>
                              {selectedHistoryItem?.id === record.id ? '▲' : '▼'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded Details */}
                      {selectedHistoryItem?.id === record.id && (
                        <View style={styles.historyItemDetails}>
                          <View style={styles.historyDetailRow}>
                            <Text style={styles.historyDetailLabel}>Cashier:</Text>
                            <Text style={styles.historyDetailValue}>
                              {record.cashier_name || record.cashier_username || 'Unknown'}
                            </Text>
                          </View>
                          <View style={styles.historyDetailRow}>
                            <Text style={styles.historyDetailLabel}>Transactions:</Text>
                            <Text style={styles.historyDetailValue}>{record.transaction_count || 0}</Text>
                          </View>
                          <View style={styles.historyDetailRow}>
                            <Text style={styles.historyDetailLabel}>Gross Sales:</Text>
                            <Text style={styles.historyDetailValue}>{formatCurrency(record.gross_sales || 0)}</Text>
                          </View>
                          <View style={styles.historyDetailRow}>
                            <Text style={styles.historyDetailLabel}>Discounts:</Text>
                            <Text style={styles.historyDetailValueRed}>({formatCurrency(record.discount_amount || 0)})</Text>
                          </View>
                          <View style={styles.historyDetailRow}>
                            <Text style={styles.historyDetailLabel}>Net Sales:</Text>
                            <Text style={styles.historyDetailValueBold}>{formatCurrency(record.net_sales || 0)}</Text>
                          </View>
                          <View style={styles.historyDetailRow}>
                            <Text style={styles.historyDetailLabel}>Voids:</Text>
                            <Text style={styles.historyDetailValueRed}>
                              {record.void_count || 0} ({formatCurrency(record.void_amount || 0)})
                            </Text>
                          </View>

                          {/* Action Buttons */}
                          <View style={styles.historyActionRow}>
                            <TouchableOpacity
                              style={[styles.historyActionBtn, isHistoryPrinting && styles.actionBtnDisabled]}
                              onPress={() => handleHistoryPrint(record)}
                              disabled={isHistoryPrinting || isHistoryExporting || isHistoryEmailing}
                            >
                              {isHistoryPrinting ? (
                                <ActivityIndicator size="small" color="#6200EE" />
                              ) : (
                                <>
                                  <Text style={styles.historyActionIcon}>🖨️</Text>
                                  <Text style={styles.historyActionText}>Print</Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.historyActionBtn, isHistoryExporting && styles.actionBtnDisabled]}
                              onPress={() => handleHistoryExportPdf(record)}
                              disabled={isHistoryPrinting || isHistoryExporting || isHistoryEmailing}
                            >
                              {isHistoryExporting ? (
                                <ActivityIndicator size="small" color="#6200EE" />
                              ) : (
                                <>
                                  <Text style={styles.historyActionIcon}>📄</Text>
                                  <Text style={styles.historyActionText}>PDF</Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.historyActionBtn, isHistoryEmailing && styles.actionBtnDisabled]}
                              onPress={() => handleHistoryEmail(record)}
                              disabled={isHistoryPrinting || isHistoryExporting || isHistoryEmailing}
                            >
                              {isHistoryEmailing ? (
                                <ActivityIndicator size="small" color="#6200EE" />
                              ) : (
                                <>
                                  <Text style={styles.historyActionIcon}>📧</Text>
                                  <Text style={styles.historyActionText}>Email</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )
          ) : isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6200EE" />
              <Text style={styles.loadingText}>Loading data...</Text>
            </View>
          ) : data ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Date/Time */}
              <View style={styles.dateTimeBox}>
                <Text style={styles.dateText}>{formatDate(data.date)}</Text>
                <Text style={styles.timeText}>As of {data.time}</Text>
              </View>

              {/* Sales Summary */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SALES SUMMARY</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Transaction Count</Text>
                  <Text style={styles.rowValue}>{data.transaction_count}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Gross Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.gross_sales)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Less: Discounts</Text>
                  <Text style={styles.rowValueRed}>({formatCurrency(data.discount_amount)})</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Less: Refunds</Text>
                  <Text style={styles.rowValueRed}>({formatCurrency(data.refund_amount)})</Text>
                </View>
                <View style={styles.rowTotal}>
                  <Text style={styles.rowLabelBold}>Net Sales</Text>
                  <Text style={styles.rowValueBold}>{formatCurrency(data.net_sales)}</Text>
                </View>
              </View>

              {/* VAT Breakdown */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>VAT BREAKDOWN</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>VATable Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.vat_sales)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>VAT Amount (12%)</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.vat_amount)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>VAT Exempt Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.vat_exempt_sales)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Zero-Rated Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.zero_rated_sales)}</Text>
                </View>
              </View>

              {/* Payment Methods */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>BY PAYMENT METHOD</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Cash Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.cash_sales)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Card Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.card_sales)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Check Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.check_sales)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Credit/Charge Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.credit_sales)}</Text>
                </View>
              </View>

              {/* Voids */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>VOIDS</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Void Count</Text>
                  <Text style={styles.rowValue}>{data.void_count}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Void Amount</Text>
                  <Text style={styles.rowValueRed}>{formatCurrency(data.void_amount)}</Text>
                </View>
              </View>

              {/* Cash Drawer */}
              <View style={styles.sectionHighlight}>
                <Text style={styles.sectionTitle}>CASH DRAWER</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Beginning Cash</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.beginning_cash)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Add: Cash Sales</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.cash_sales)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Add: Cash Fund</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.cash_fund)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Less: Petty Cash</Text>
                  <Text style={styles.rowValueRed}>({formatCurrency(data.petty_cash)})</Text>
                </View>
                <View style={styles.rowTotal}>
                  <Text style={styles.rowLabelBold}>Expected Cash</Text>
                  <Text style={styles.rowValueBoldGreen}>{formatCurrency(data.expected_cash)}</Text>
                </View>
              </View>

              {/* Info Note */}
              <View style={styles.infoNote}>
                <Text style={styles.infoIcon}>ℹ️</Text>
                <Text style={styles.infoText}>
                  X-Reading is a mid-day inquiry and does NOT reset any counters.
                  Use Z-Reading for end-of-day closing.
                </Text>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load data</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, isPrinting && styles.actionBtnDisabled]}
              onPress={handlePrint}
              disabled={isPrinting || isLoading || !data}
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
              disabled={isExporting || isLoading || !data}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#6200EE" />
              ) : (
                <>
                  <Text style={styles.actionBtnIcon}>📄</Text>
                  <Text style={styles.actionBtnText}>PDF</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, isEmailing && styles.actionBtnDisabled]}
              onPress={handleEmail}
              disabled={isEmailing || isLoading || !data}
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

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              onPress={handleSaveXReading}
              disabled={isSaving || isLoading}
            >
              <Text style={styles.saveBtnText}>
                {isSaving ? 'Saving...' : 'Save X-Reading'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#6200EE',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#E1BEE7',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#757575',
  },
  errorContainer: {
    padding: 60,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
  },
  content: {
    padding: 16,
  },
  dateTimeBox: {
    backgroundColor: '#F3E5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6200EE',
  },
  timeText: {
    fontSize: 13,
    color: '#7C4DFF',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
  },
  sectionHighlight: {
    marginBottom: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#757575',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  rowLabel: {
    fontSize: 14,
    color: '#616161',
  },
  rowLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  rowValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  rowValueRed: {
    fontSize: 14,
    fontWeight: '500',
    color: '#D32F2F',
  },
  rowValueBoldGreen: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 80,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6200EE',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#6200EE',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#B39DDB',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // History styles
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 4,
  },
  historyToggleActive: {
    backgroundColor: '#FFFFFF',
  },
  historyToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historyToggleTextActive: {
    color: '#6200EE',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 4,
  },
  historyItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  historyItemTime: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyItemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4CAF50',
  },
  historyItemChevron: {
    fontSize: 10,
    color: '#9E9E9E',
    marginTop: 2,
  },
  historyItemDetails: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: -4,
    marginBottom: 8,
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
  historyActionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  historyActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6200EE',
  },
});
