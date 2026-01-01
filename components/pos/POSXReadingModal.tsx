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
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { DatabaseService } from '../../database/DatabaseService';

interface POSXReadingModalProps {
  visible: boolean;
  onClose: () => void;
  cashierId: number;
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
  cash_fund: number;
  petty_cash: number;
  expected_cash: number;
}

export default function POSXReadingModal({
  visible,
  onClose,
  cashierId,
}: POSXReadingModalProps) {
  const [data, setData] = useState<XReadingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadXReadingData();
    }
  }, [visible]);

  const loadXReadingData = async () => {
    setIsLoading(true);
    try {
      const db = DatabaseService.getInstance();

      // Get current shift's start_time to filter data by shift
      let shiftStartTime: string | undefined;
      const currentShift = await db.getCurrentShift(cashierId);
      if (currentShift) {
        shiftStartTime = currentShift.start_time;
      }

      // Pass shift start time to get only current shift's data
      const xReadingData = await db.getXReadingData(undefined, shiftStartTime);
      setData(xReadingData);
    } catch (error) {
      console.error('Error loading X-Reading data:', error);
      Alert.alert('Error', 'Failed to load X-Reading data');
    } finally {
      setIsLoading(false);
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
              <Text style={styles.headerSubtitle}>Mid-Day Inquiry Report</Text>
            </View>
            <IconButton icon="close" size={24} onPress={onClose} />
          </View>

          {isLoading ? (
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
                  <Text style={styles.rowLabel}>Cash Fund Added</Text>
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
});
