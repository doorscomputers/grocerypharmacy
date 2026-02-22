import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { DatabaseService } from '../../database/DatabaseService';
import POSInvoiceListPicker, { InvoiceTransaction } from './POSInvoiceListPicker';
import POSDiscountWarningBanner from './POSDiscountWarningBanner';
import POSTransactionCompleteDialog, { TransactionCompleteData } from './POSTransactionCompleteDialog';
import { useResponsiveTheme } from '../../utils/responsive';

interface POSVoidModalProps {
  visible: boolean;
  onClose: () => void;
  cashierId: number;
  onSuccess?: () => void;
}

interface TransactionData {
  id: number;
  invoice_number: string;
  transaction_number: string;
  customer_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  status: string;
  transaction_date: string;
  sc_pwd_id?: string;
  sc_pwd_name?: string;
  sc_pwd_type?: 'SENIOR' | 'PWD';
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
}

export default function POSVoidModal({
  visible,
  onClose,
  cashierId,
  onSuccess,
}: POSVoidModalProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [voidReason, setVoidReason] = useState('');
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeData, setCompleteData] = useState<TransactionCompleteData | null>(null);
  const [cashierName, setCashierName] = useState<string>('');

  // Load cashier name
  useEffect(() => {
    const loadCashierName = async () => {
      try {
        const db = DatabaseService.getInstance();
        const user = await db.getUserById(cashierId);
        if (user) {
          setCashierName(user.full_name || user.username);
        }
      } catch (error) {
        console.error('Error loading cashier name:', error);
      }
    };
    if (cashierId) {
      loadCashierName();
    }
  }, [cashierId]);

  // Validate transaction can be voided
  const validateTransactionForVoid = async (result: any): Promise<boolean> => {
    if (!result) {
      Alert.alert('Not Found', 'No transaction found with that invoice number');
      return false;
    }

    if (result.status === 'VOID') {
      Alert.alert('Already Voided', 'This transaction has already been voided');
      return false;
    }

    if (result.status === 'REFUNDED') {
      Alert.alert('Cannot Void', 'This transaction has been refunded and cannot be voided.\n\nRefunded transactions cannot be voided because items have already been returned to inventory.');
      return false;
    }

    // Check if transaction has any associated returns (partial refunds or exchanges)
    const db = DatabaseService.getInstance();
    const returns = await db.getSalesReturnsByTransaction(result.id);
    if (returns && returns.length > 0) {
      Alert.alert('Cannot Void', 'This transaction has associated refunds or exchanges and cannot be voided.\n\nPlease void the refund/exchange first or process items individually.');
      return false;
    }

    if (result.status !== 'COMPLETED') {
      Alert.alert('Invalid Status', 'Only completed transactions can be voided');
      return false;
    }

    // NEW: Check if transaction belongs to a closed shift
    const shiftCheck = await db.isTransactionInClosedShift(result.id);
    if (shiftCheck.isClosedShift) {
      Alert.alert(
        'Shift Closed',
        'This transaction belongs to a closed shift and cannot be voided.\n\nTransactions can only be voided during the shift they were created in. Once a shift is closed or End of Day is performed, transactions from that shift are locked.\n\nShift ID: ' + (shiftCheck.shiftId || 'Unknown'),
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  // Handle invoice search from the picker
  const handleSearchInvoice = async (invoiceNumber: string) => {
    setIsSearching(true);
    try {
      const db = DatabaseService.getInstance();
      const result = await db.searchTransactionByInvoice(invoiceNumber);

      if (await validateTransactionForVoid(result)) {
        setTransaction(result);
      } else {
        setTransaction(null);
      }
    } catch (error) {
      console.error('Error searching transaction:', error);
      Alert.alert('Error', 'Failed to search for transaction');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle invoice selection from browse list
  const handleSelectInvoice = async (invoice: InvoiceTransaction) => {
    setIsSearching(true);
    try {
      const db = DatabaseService.getInstance();
      // Fetch full transaction details including items
      const result = await db.searchTransactionByInvoice(invoice.invoice_number || invoice.transaction_number);

      if (await validateTransactionForVoid(result)) {
        setTransaction(result);
      } else {
        setTransaction(null);
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      Alert.alert('Error', 'Failed to load transaction details');
    } finally {
      setIsSearching(false);
    }
  };

  const handleVoid = async () => {
    if (!transaction) return;

    if (!voidReason.trim()) {
      Alert.alert('Error', 'Please enter a reason for voiding');
      return;
    }

    const hasDiscount = transaction.discount_amount > 0;
    const discountWarning = hasDiscount
      ? `\n\n⚠️ NOTE: This transaction has a ₱${transaction.discount_amount.toFixed(2)} discount applied.`
      : '';

    Alert.alert(
      'Confirm Void',
      `Are you sure you want to void this transaction?\n\nInvoice: ${transaction.invoice_number}\nAmount: ₱${transaction.total_amount.toFixed(2)}${discountWarning}\n\nThis action will:\n• Restore all item quantities to inventory\n• Mark the transaction as VOID\n• Update accounts if applicable\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void Transaction',
          style: 'destructive',
          onPress: async () => {
            setIsVoiding(true);
            try {
              const db = DatabaseService.getInstance();
              await db.voidTransaction({
                transaction_id: transaction.id,
                void_reason: voidReason.trim(),
                void_by: cashierId,
              });

              // Prepare data for complete dialog
              const voidRefNumber = `VOID-${transaction.invoice_number}`;
              setCompleteData({
                transactionType: 'VOID',
                referenceNumber: voidRefNumber,
                originalInvoice: transaction.invoice_number,
                customerName: transaction.customer_name,
                totalAmount: transaction.total_amount,
                reason: voidReason.trim(),
                items: transaction.items?.map(item => ({
                  name: item.product_name,
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                  totalAmount: item.total_amount,
                })) || [],
                cashierName: cashierName,
                transactionDate: new Date(),
              });
              setShowCompleteDialog(true);
              onSuccess?.();
            } catch (error) {
              console.error('Error voiding transaction:', error);
              Alert.alert('Error', 'Failed to void transaction');
            } finally {
              setIsVoiding(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setVoidReason('');
    setTransaction(null);
    setShowCompleteDialog(false);
    setCompleteData(null);
    onClose();
  };

  const handleCompleteDialogClose = () => {
    setShowCompleteDialog(false);
    setCompleteData(null);
    handleClose();
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const voidReasons = [
    'Customer changed mind',
    'Wrong item scanned',
    'Price error',
    'Double entry',
    'Customer cannot pay',
    'System error',
  ];

  return (
    <>
    <Modal
      visible={visible && !showCompleteDialog}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { maxWidth: lo.modalMaxWidth }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontSize: fs.h2 }]}>Void Transaction</Text>
            <IconButton icon="close" size={24} iconColor="#FFFFFF" onPress={handleClose} />
          </View>

          <ScrollView style={[styles.content, { padding: sp.md }]} showsVerticalScrollIndicator={false}>
            {/* Invoice Picker (when no transaction selected) */}
            {!transaction && (
              <View style={styles.pickerContainer}>
                <POSInvoiceListPicker
                  onSelectInvoice={handleSelectInvoice}
                  onSearchInvoice={handleSearchInvoice}
                  isSearching={isSearching}
                  accentColor="#D32F2F"
                  excludeWithReturns={true}
                  cashierId={cashierId}
                  todayOnly={true}
                  excludeClosedShifts={true}
                />
              </View>
            )}

            {/* Transaction Details */}
            {transaction && (
              <>
                {/* Discount Warning Banner */}
                {transaction.discount_amount > 0 && (
                  <POSDiscountWarningBanner
                    discountAmount={transaction.discount_amount}
                    totalAmount={transaction.total_amount}
                    originalAmount={(transaction.subtotal || 0) + (transaction.tax_amount || 0)}
                    scPwdId={transaction.sc_pwd_id}
                    scPwdName={transaction.sc_pwd_name}
                    scPwdType={transaction.sc_pwd_type}
                  />
                )}

                <View style={styles.transactionBox}>
                  <View style={styles.transactionHeader}>
                    <Text style={styles.invoiceLabel}>{transaction.invoice_number}</Text>
                    <Text style={styles.statusBadge}>{transaction.status}</Text>
                  </View>
                  <Text style={styles.transactionDate}>{formatDate(transaction.transaction_date)}</Text>
                  {transaction.customer_name && (
                    <Text style={styles.customerName}>Customer: {transaction.customer_name}</Text>
                  )}
                  <Text style={styles.paymentMethod}>Payment: {transaction.payment_method}</Text>

                  {/* Items List */}
                  <View style={styles.itemsList}>
                    <Text style={styles.itemsTitle}>Items to be restored:</Text>
                    {transaction.items?.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.product_name}</Text>
                          <Text style={styles.itemQty}>{item.quantity} x {formatCurrency(item.unit_price)}</Text>
                        </View>
                        <Text style={styles.itemTotal}>{formatCurrency(item.total_amount)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>{formatCurrency(transaction.total_amount)}</Text>
                  </View>
                </View>

                {/* Void Reason */}
                <View style={styles.section}>
                  <Text style={styles.label}>Reason for Voiding *</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={voidReason}
                    onChangeText={setVoidReason}
                    placeholder="Why is this transaction being voided?"
                    placeholderTextColor="#9E9E9E"
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Quick Reasons */}
                <View style={styles.quickReasons}>
                  {voidReasons.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonChip,
                        voidReason === reason && styles.reasonChipActive,
                      ]}
                      onPress={() => setVoidReason(reason)}
                    >
                      <Text
                        style={[
                          styles.reasonChipText,
                          voidReason === reason && styles.reasonChipTextActive,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Warning */}
                <View style={styles.warningBox}>
                  <Text style={styles.warningIcon}>⚠️</Text>
                  <Text style={styles.warningText}>
                    Voiding this transaction will restore all {transaction.items?.length || 0} items back to inventory.
                    {transaction.payment_method === 'CHARGE_INVOICE' && ' The accounts receivable entry will also be reversed.'}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={transaction ? () => setTransaction(null) : handleClose}
              disabled={isVoiding}
            >
              <Text style={styles.cancelBtnText}>
                {transaction ? 'Back' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            {transaction && (
              <TouchableOpacity
                style={[styles.voidBtn, (isVoiding || !voidReason.trim()) && styles.voidBtnDisabled]}
                onPress={handleVoid}
                disabled={isVoiding || !voidReason.trim()}
              >
                <Text style={[styles.voidBtnText, { fontSize: fs.button }]}>
                  {isVoiding ? 'Voiding...' : 'Void Transaction'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Transaction Complete Dialog with Print/Email */}
    <POSTransactionCompleteDialog
      visible={showCompleteDialog}
      onClose={handleCompleteDialogClose}
      data={completeData}
    />
    </>
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
    maxWidth: 450,
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
    backgroundColor: '#D32F2F',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  pickerContainer: {
    minHeight: 450,
  },
  searchBox: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  searchBtn: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  transactionBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 2,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 12,
  },
  itemsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  itemQty: {
    fontSize: 12,
    color: '#757575',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#EF9A9A',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C62828',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C62828',
  },
  section: {
    marginBottom: 12,
  },
  reasonInput: {
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
    textAlignVertical: 'top',
    minHeight: 60,
  },
  quickReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reasonChipActive: {
    backgroundColor: '#FFEBEE',
    borderColor: '#D32F2F',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#616161',
  },
  reasonChipTextActive: {
    color: '#C62828',
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  voidBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
  },
  voidBtnDisabled: {
    backgroundColor: '#EF9A9A',
  },
  voidBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
