import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Checkbox } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { DatabaseService } from '../database/DatabaseService';
import POSInvoiceListPicker, { InvoiceTransaction } from '../components/pos/POSInvoiceListPicker';
import POSDiscountWarningBanner from '../components/pos/POSDiscountWarningBanner';
import POSTransactionCompleteDialog, { TransactionCompleteData } from '../components/pos/POSTransactionCompleteDialog';
import { useResponsiveTheme, useLandscapeLayout } from '../utils/responsive';

type RefundScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Refund'>;
type RefundScreenRouteProp = RouteProp<RootStackParamList, 'Refund'>;

interface Props {
  navigation: RefundScreenNavigationProp;
  route: RefundScreenRouteProp;
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

export default function RefundScreen({ navigation, route }: Props) {
  const cashierId = route.params.cashierId;
  const { sp, fs } = useResponsiveTheme();
  const { canSplit, leftPanelWidth, rightPanelWidth } = useLandscapeLayout({ leftRatio: 0.5 });
  const insets = useSafeAreaInsets();

  const [refundReason, setRefundReason] = useState('');
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT'>('CASH');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeData, setCompleteData] = useState<TransactionCompleteData | null>(null);
  const [cashierName, setCashierName] = useState<string>('');
  const [editingQty, setEditingQty] = useState<number | null>(null);
  const [editingQtyText, setEditingQtyText] = useState('');

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

  const setupTransactionForRefund = (result: any) => {
    const itemsWithRefund = result.items.map((item: any) => ({
      ...item,
      refund_quantity: 0,
      selected: false,
    }));
    setTransaction({ ...result, items: itemsWithRefund });

    if (result.payment_method === 'CHARGE_INVOICE') {
      setRefundMethod('CREDIT');
    } else {
      setRefundMethod('CASH');
    }
  };

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

  const handleSelectInvoice = async (invoice: InvoiceTransaction) => {
    setIsSearching(true);
    try {
      const db = DatabaseService.getInstance();
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

  const handleCompleteDialogClose = () => {
    setShowCompleteDialog(false);
    setCompleteData(null);
    navigation.goBack();
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

  // ===== Render the item selection content =====
  const renderItemSelection = () => {
    if (!transaction) return null;
    return (
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
                {editingQty === index ? (
                  <TextInput
                    style={styles.qtyInput}
                    value={editingQtyText}
                    onChangeText={setEditingQtyText}
                    onBlur={() => {
                      const val = parseInt(editingQtyText) || 0;
                      updateRefundQuantity(index, val);
                      setEditingQty(null);
                    }}
                    keyboardType="numeric"
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <TouchableOpacity onPress={() => {
                    setEditingQty(index);
                    setEditingQtyText(String(item.refund_quantity));
                  }}>
                    <Text style={styles.qtyValue}>
                      {item.refund_quantity}/{item.quantity}
                    </Text>
                  </TouchableOpacity>
                )}
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
      </>
    );
  };

  // ===== Render the refund details (method, reason, total) =====
  const renderRefundDetails = () => {
    if (!transaction) return null;
    return (
      <>
        {/* Refund Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refund Method</Text>
          <View style={styles.methodOptions}>
            {transaction.payment_method === 'CHARGE_INVOICE' ? (
              <TouchableOpacity style={[styles.methodBtn, styles.methodBtnActive]} disabled>
                <Text style={[styles.methodBtnText, styles.methodBtnTextActive]}>Credit Balance</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.methodBtn, styles.methodBtnActive]} disabled>
                <Text style={[styles.methodBtnText, styles.methodBtnTextActive]}>Cash Refund</Text>
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
              style={[styles.reasonChip, refundReason === reason && styles.reasonChipActive]}
              onPress={() => setRefundReason(reason)}
            >
              <Text style={[styles.reasonChipText, refundReason === reason && styles.reasonChipTextActive]}>
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
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Invoice Picker (when no transaction selected) */}
      {!transaction && (
        <ScrollView style={styles.contentPadding} contentContainerStyle={{ flexGrow: 1 }}>
          <POSInvoiceListPicker
            onSelectInvoice={handleSelectInvoice}
            onSearchInvoice={handleSearchInvoice}
            isSearching={isSearching}
            accentColor="#FF9800"
            excludeWithReturns={true}
          />
        </ScrollView>
      )}

      {/* Transaction Selected - Show item selection + refund details */}
      {transaction && (
        <>
          {canSplit ? (
            /* Landscape two-column layout */
            <View style={styles.splitRow}>
              <ScrollView style={[styles.splitLeft, { width: leftPanelWidth }]} contentContainerStyle={styles.splitPanelContent}>
                {renderItemSelection()}
              </ScrollView>
              <ScrollView style={[styles.splitRight, { width: rightPanelWidth }]} contentContainerStyle={styles.splitPanelContent}>
                {renderRefundDetails()}
              </ScrollView>
            </View>
          ) : (
            /* Portrait single-column layout */
            <ScrollView style={styles.contentPadding} showsVerticalScrollIndicator={false}>
              {renderItemSelection()}
              {renderRefundDetails()}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setTransaction(null)}
              disabled={isProcessing}
            >
              <Text style={styles.cancelBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.refundBtn, (isProcessing || calculateRefundTotal() === 0) && styles.refundBtnDisabled]}
              onPress={handleRefund}
              disabled={isProcessing || calculateRefundTotal() === 0}
            >
              <Text style={[styles.refundBtnText, { fontSize: fs.button }]}>
                {isProcessing ? 'Processing...' : 'Process Refund'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Transaction Complete Dialog */}
      <POSTransactionCompleteDialog
        visible={showCompleteDialog}
        onClose={handleCompleteDialogClose}
        data={completeData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentPadding: {
    flex: 1,
    padding: 16,
  },

  // Landscape split
  splitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  splitLeft: {
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  splitRight: {
    backgroundColor: '#FAFAFA',
  },
  splitPanelContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Transaction info
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

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 8,
  },

  // Item rows
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
  qtyInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    minWidth: 40,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FF9800',
    paddingVertical: 2,
  },

  // Refund method
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

  // Reason
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

  // Total
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

  // Footer
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
    backgroundColor: '#FFFFFF',
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
