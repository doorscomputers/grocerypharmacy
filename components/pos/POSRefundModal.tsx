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
import { IconButton, Checkbox } from 'react-native-paper';
import { DatabaseService } from '../../database/DatabaseService';
import POSInvoiceListPicker, { InvoiceTransaction } from './POSInvoiceListPicker';
import POSDiscountWarningBanner from './POSDiscountWarningBanner';
import POSTransactionCompleteDialog, { TransactionCompleteData } from './POSTransactionCompleteDialog';
import { useResponsiveTheme } from '../../utils/responsive';

interface POSRefundModalProps {
  visible: boolean;
  onClose: () => void;
  cashierId: number;
  onSuccess?: () => void;
}

interface TransactionItem {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  refund_quantity: number;
  selected: boolean;
}

interface TransactionData {
  id: number;
  invoice_number: string;
  customer_id?: number;
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
  items: TransactionItem[];
}

export default function POSRefundModal({
  visible,
  onClose,
  cashierId,
  onSuccess,
}: POSRefundModalProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [refundReason, setRefundReason] = useState('');
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT'>('CASH');
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

  // Helper to set up transaction with refund properties
  const setupTransactionForRefund = (result: any) => {
    // Add refund properties to items
    const itemsWithRefund = result.items.map((item: any) => ({
      ...item,
      refund_quantity: 0,
      selected: false,
    }));
    setTransaction({ ...result, items: itemsWithRefund });

    // Set default refund method based on original payment
    if (result.payment_method === 'CHARGE_INVOICE') {
      setRefundMethod('CREDIT');
    } else {
      setRefundMethod('CASH');
    }
  };

  // Handle invoice search from the picker
  const handleSearchInvoice = async (invoiceNumber: string) => {
    setIsSearching(true);
    try {
      const db = DatabaseService.getInstance();
      const result = await db.searchTransactionByInvoice(invoiceNumber);

      if (!result) {
        Alert.alert('Not Found', 'No transaction found with that invoice number');
        setTransaction(null);
      } else if (result.status === 'VOID') {
        Alert.alert('Voided Transaction', 'Cannot refund a voided transaction');
        setTransaction(null);
      } else if (result.status !== 'COMPLETED' && result.status !== 'REFUNDED') {
        Alert.alert('Invalid Status', 'Only completed transactions can be refunded');
        setTransaction(null);
      } else {
        setupTransactionForRefund(result);
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
      if (result) {
        setupTransactionForRefund(result);
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      Alert.alert('Error', 'Failed to load transaction details');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleItem = (index: number) => {
    if (!transaction) return;
    const newItems = [...transaction.items];
    newItems[index].selected = !newItems[index].selected;
    if (newItems[index].selected && newItems[index].refund_quantity === 0) {
      newItems[index].refund_quantity = newItems[index].quantity;
    } else if (!newItems[index].selected) {
      newItems[index].refund_quantity = 0;
    }
    setTransaction({ ...transaction, items: newItems });
  };

  const updateRefundQuantity = (index: number, qty: number) => {
    if (!transaction) return;
    const newItems = [...transaction.items];
    const maxQty = newItems[index].quantity;
    newItems[index].refund_quantity = Math.min(Math.max(0, qty), maxQty);
    newItems[index].selected = newItems[index].refund_quantity > 0;
    setTransaction({ ...transaction, items: newItems });
  };

  const calculateRefundTotal = () => {
    if (!transaction) return 0;
    return transaction.items.reduce((sum, item) => {
      if (item.selected && item.refund_quantity > 0) {
        return sum + (item.unit_price * item.refund_quantity);
      }
      return sum;
    }, 0);
  };

  const handleRefund = async () => {
    if (!transaction) return;

    const selectedItems = transaction.items.filter(i => i.selected && i.refund_quantity > 0);
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please select at least one item to refund');
      return;
    }

    if (!refundReason.trim()) {
      Alert.alert('Error', 'Please enter a reason for the refund');
      return;
    }

    const refundTotal = calculateRefundTotal();
    const hasDiscount = transaction.discount_amount > 0;
    const discountWarning = hasDiscount
      ? `\n\n⚠️ NOTE: Original transaction had a ₱${transaction.discount_amount.toFixed(2)} discount. Refund is based on actual paid amounts.`
      : '';

    Alert.alert(
      'Confirm Refund',
      `Process refund of ${formatCurrency(refundTotal)}?\n\n${selectedItems.length} item(s) will be returned to inventory.\nRefund method: ${refundMethod}${discountWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process Refund',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const db = DatabaseService.getInstance();

              // Process the refund
              await db.processSalesReturn({
                original_transaction_id: transaction.id,
                original_transaction_number: transaction.invoice_number,
                customer_id: transaction.customer_id,
                customer_name: transaction.customer_name,
                items: selectedItems.map(item => ({
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.refund_quantity,
                  unit_price: item.unit_price,
                  reason: refundReason,
                })),
                refund_method: refundMethod === 'CASH' ? 'CASH' : 'CREDIT',
                notes: refundReason,
                created_by: cashierId,
              });

              // Note: cash movement is already created inside processSalesReturn()

              // Prepare data for complete dialog
              const refundRefNumber = `RTN-${Date.now().toString().slice(-6)}`;
              setCompleteData({
                transactionType: 'REFUND',
                referenceNumber: refundRefNumber,
                originalInvoice: transaction.invoice_number,
                customerName: transaction.customer_name,
                totalAmount: refundTotal,
                reason: refundReason.trim(),
                items: selectedItems.map(item => ({
                  name: item.product_name,
                  quantity: item.refund_quantity,
                  unitPrice: item.unit_price,
                  totalAmount: item.unit_price * item.refund_quantity,
                })),
                refundMethod: refundMethod,
                cashierName: cashierName,
                transactionDate: new Date(),
              });
              setShowCompleteDialog(true);
              onSuccess?.();
            } catch (error) {
              console.error('Error processing refund:', error);
              Alert.alert('Error', 'Failed to process refund');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setRefundReason('');
    setTransaction(null);
    setRefundMethod('CASH');
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

  const refundReasons = [
    'Defective/Damaged',
    'Wrong item',
    'Not satisfied',
    'Customer request',
    'Price issue',
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
            <Text style={[styles.headerTitle, { fontSize: fs.h2 }]}>Process Refund</Text>
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
                  accentColor="#FF9800"
                  excludeWithReturns={true}
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

                <View style={styles.transactionInfo}>
                  <Text style={styles.invoiceLabel}>{transaction.invoice_number}</Text>
                  <Text style={styles.transactionMeta}>
                    {transaction.customer_name || 'Walk-in'} | {transaction.payment_method}
                  </Text>
                </View>

                {/* Items Selection */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Select Items to Refund</Text>
                  {transaction.items.map((item, index) => (
                    <View key={item.id || index} style={styles.itemRow}>
                      <Checkbox
                        status={item.selected ? 'checked' : 'unchecked'}
                        onPress={() => toggleItem(index)}
                        color="#FF9800"
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <Text style={styles.itemPrice}>{formatCurrency(item.unit_price)} each</Text>
                      </View>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateRefundQuantity(index, item.refund_quantity - 1)}
                        >
                          <Text style={styles.qtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>
                          {item.refund_quantity}/{item.quantity}
                        </Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateRefundQuantity(index, item.refund_quantity + 1)}
                        >
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Refund Method */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Refund Method</Text>
                  <View style={styles.methodOptions}>
                    {transaction.payment_method === 'CHARGE_INVOICE' ? (
                      <TouchableOpacity
                        style={[styles.methodBtn, styles.methodBtnActive]}
                        disabled
                      >
                        <Text style={[styles.methodBtnText, styles.methodBtnTextActive]}>
                          Credit Balance
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.methodBtn, styles.methodBtnActive]}
                        disabled
                      >
                        <Text style={[styles.methodBtnText, styles.methodBtnTextActive]}>
                          Cash Refund
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {transaction.payment_method === 'CHARGE_INVOICE' ? (
                    <Text style={styles.methodNote}>This was a Charge Invoice — refund reduces the customer's outstanding balance</Text>
                  ) : (
                    <Text style={styles.methodNote}>Cash will be deducted from drawer balance</Text>
                  )}
                </View>

                {/* Refund Reason */}
                <View style={styles.section}>
                  <Text style={styles.label}>Reason for Refund *</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={refundReason}
                    onChangeText={setRefundReason}
                    placeholder="Why is this being refunded?"
                    placeholderTextColor="#9E9E9E"
                    multiline
                  />
                </View>

                {/* Quick Reasons */}
                <View style={styles.quickReasons}>
                  {refundReasons.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonChip,
                        refundReason === reason && styles.reasonChipActive,
                      ]}
                      onPress={() => setRefundReason(reason)}
                    >
                      <Text
                        style={[
                          styles.reasonChipText,
                          refundReason === reason && styles.reasonChipTextActive,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Refund Total */}
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>Refund Total</Text>
                  <Text style={styles.totalValue}>{formatCurrency(calculateRefundTotal())}</Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={transaction ? () => setTransaction(null) : handleClose}
              disabled={isProcessing}
            >
              <Text style={styles.cancelBtnText}>
                {transaction ? 'Back' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            {transaction && (
              <TouchableOpacity
                style={[styles.refundBtn, (isProcessing || calculateRefundTotal() === 0) && styles.refundBtnDisabled]}
                onPress={handleRefund}
                disabled={isProcessing || calculateRefundTotal() === 0}
              >
                <Text style={[styles.refundBtnText, { fontSize: fs.button }]}>
                  {isProcessing ? 'Processing...' : 'Process Refund'}
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
    backgroundColor: '#FF9800',
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
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  transactionInfo: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  invoiceLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
  },
  transactionMeta: {
    fontSize: 13,
    color: '#757575',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  itemPrice: {
    fontSize: 12,
    color: '#757575',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#424242',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    minWidth: 40,
    textAlign: 'center',
  },
  methodOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  methodBtnActive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  methodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  methodBtnTextActive: {
    color: '#E65100',
  },
  methodNote: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
  },
  reasonInput: {
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
    minHeight: 50,
  },
  quickReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reasonChipActive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  reasonChipText: {
    fontSize: 12,
    color: '#616161',
  },
  reasonChipTextActive: {
    color: '#E65100',
    fontWeight: '600',
  },
  totalBox: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E7D32',
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
  refundBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#FF9800',
    alignItems: 'center',
  },
  refundBtnDisabled: {
    backgroundColor: '#FFCC80',
  },
  refundBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
