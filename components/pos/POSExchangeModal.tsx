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
  FlatList,
} from 'react-native';
import { IconButton, Checkbox } from 'react-native-paper';
import { DatabaseService } from '../../database/DatabaseService';
import POSInvoiceListPicker, { InvoiceTransaction } from './POSInvoiceListPicker';
import POSDiscountWarningBanner from './POSDiscountWarningBanner';
import POSTransactionCompleteDialog, { TransactionCompleteData } from './POSTransactionCompleteDialog';
import { useResponsiveTheme } from '../../utils/responsive';

interface POSExchangeModalProps {
  visible: boolean;
  onClose: () => void;
  cashierId: number;
  onSuccess?: () => void;
}

interface ReturnItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  return_quantity: number;
  selected: boolean;
}

interface NewItem {
  id: number;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

export default function POSExchangeModal({
  visible,
  onClose,
  cashierId,
  onSuccess,
}: POSExchangeModalProps) {
  const { sp, fs, lo } = useResponsiveTheme();
  const [step, setStep] = useState<'search' | 'select_returns' | 'add_new'>('search');
  const [transaction, setTransaction] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [exchangeReason, setExchangeReason] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
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

  // Helper to set up transaction for exchange
  const setupTransactionForExchange = (result: any) => {
    setTransaction(result);
    setReturnItems(result.items.map((item: any) => ({
      ...item,
      return_quantity: 0,
      selected: false,
    })));
    setStep('select_returns');
  };

  // Handle invoice search from the picker
  const handleSearchInvoice = async (invoiceNumber: string) => {
    setIsSearching(true);
    try {
      const db = DatabaseService.getInstance();
      const result = await db.searchTransactionByInvoice(invoiceNumber);

      if (!result) {
        Alert.alert('Not Found', 'No transaction found');
        return;
      }
      if (result.status === 'VOID') {
        Alert.alert('Invalid', 'Cannot exchange from voided transaction');
        return;
      }

      setupTransactionForExchange(result);
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search');
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
      if (result && result.status !== 'VOID') {
        setupTransactionForExchange(result);
      } else if (result?.status === 'VOID') {
        Alert.alert('Invalid', 'Cannot exchange from voided transaction');
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      Alert.alert('Error', 'Failed to load transaction details');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleReturnItem = (index: number) => {
    const newItems = [...returnItems];
    newItems[index].selected = !newItems[index].selected;
    if (newItems[index].selected && newItems[index].return_quantity === 0) {
      newItems[index].return_quantity = newItems[index].quantity;
    } else if (!newItems[index].selected) {
      newItems[index].return_quantity = 0;
    }
    setReturnItems(newItems);
  };

  const updateReturnQuantity = (index: number, qty: number) => {
    const items = [...returnItems];
    items[index].return_quantity = Math.min(Math.max(0, qty), items[index].quantity);
    items[index].selected = items[index].return_quantity > 0;
    setReturnItems(items);
  };

  const searchProducts = async () => {
    if (!productSearch.trim()) return;

    setIsSearchingProducts(true);
    try {
      const db = DatabaseService.getInstance();
      const results = await db.getProductsWithDetails(true, 20, productSearch);
      setProducts(results);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch.trim()) {
        searchProducts();
      } else {
        setProducts([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addNewItem = (product: any) => {
    const existing = newItems.find(i => i.id === product.id);
    if (existing) {
      setNewItems(newItems.map(i =>
        i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setNewItems([...newItems, {
        id: product.id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: 1,
      }]);
    }
    setProductSearch('');
    setProducts([]);
  };

  const updateNewItemQty = (id: number, delta: number) => {
    setNewItems(newItems.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeNewItem = (id: number) => {
    setNewItems(newItems.filter(i => i.id !== id));
  };

  const calculateReturnTotal = () => {
    return returnItems.reduce((sum, item) =>
      sum + (item.selected ? item.unit_price * item.return_quantity : 0), 0);
  };

  const calculateNewTotal = () => {
    return newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateDifference = () => {
    return calculateNewTotal() - calculateReturnTotal();
  };

  const handleExchange = async () => {
    const selectedReturns = returnItems.filter(i => i.selected && i.return_quantity > 0);
    if (selectedReturns.length === 0) {
      Alert.alert('Error', 'Select items to return');
      return;
    }
    if (newItems.length === 0) {
      Alert.alert('Error', 'Add replacement items');
      return;
    }
    if (!exchangeReason.trim()) {
      Alert.alert('Error', 'Enter exchange reason');
      return;
    }

    const difference = calculateDifference();
    const isCreditTransaction = transaction.payment_method === 'CHARGE_INVOICE';

    let differenceText = '';
    if (difference > 0) {
      differenceText = isCreditTransaction
        ? `Customer balance increases by: ${formatCurrency(difference)}`
        : `Customer pays additional: ${formatCurrency(difference)}`;
    } else if (difference < 0) {
      differenceText = isCreditTransaction
        ? `Customer balance decreases by: ${formatCurrency(Math.abs(difference))}`
        : `Customer receives: ${formatCurrency(Math.abs(difference))}`;
    } else {
      differenceText = 'No payment difference';
    }

    const hasDiscount = transaction.discount_amount > 0;
    const discountWarning = hasDiscount
      ? `\n\n⚠️ NOTE: Original transaction had a ₱${transaction.discount_amount.toFixed(2)} discount. Exchange values are based on actual paid amounts.`
      : '';

    Alert.alert(
      'Confirm Exchange',
      `Return ${selectedReturns.length} item(s) for ${newItems.length} new item(s).\n\n${differenceText}${discountWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process Exchange',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const db = DatabaseService.getInstance();

              // Process return for selected items (restores inventory)
              const returnResult = await db.processSalesReturn({
                original_transaction_id: transaction.id,
                original_transaction_number: transaction.invoice_number,
                customer_id: transaction.customer_id,
                customer_name: transaction.customer_name,
                items: selectedReturns.map(item => ({
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.return_quantity,
                  unit_price: item.unit_price,
                  reason: `Exchange: ${exchangeReason}`,
                })),
                refund_method: 'EXCHANGE',
                notes: `Exchange for ${newItems.map(i => i.name).join(', ')}`,
                created_by: cashierId,
              });

              // Deduct inventory for replacement items
              for (const item of newItems) {
                await db.recordInventoryMovement({
                  product_id: item.id,
                  movement_type: 'OUT',
                  quantity: item.quantity,
                  reference_type: 'EXCHANGE',
                  reference_id: returnResult.returnId,
                  reference_number: returnResult.returnNumber,
                  notes: `Exchange replacement: ${item.name}`,
                  created_by: cashierId,
                });
              }

              // Handle difference based on payment method
              if (difference !== 0) {
                const isCreditTx = transaction.payment_method === 'CHARGE_INVOICE';

                if (isCreditTx) {
                  // Credit transaction - adjust AR balance instead of cash
                  // New balance = original balance - returned amount + replacement amount
                  // If difference < 0: balance decreases (customer owes less)
                  // If difference > 0: balance increases (customer owes more)
                  await db.adjustAccountsReceivableForExchange(
                    transaction.id,
                    difference, // positive = increase balance, negative = decrease balance
                    `Exchange adjustment - ${returnResult.returnNumber}`,
                    cashierId
                  );
                } else {
                  // Cash transaction - handle cash movements
                  if (difference < 0) {
                    // Customer receives money - cash refund
                    await db.createCashMovement({
                      movement_type: 'CASH_REFUND',
                      amount: Math.abs(difference),
                      description: `Exchange difference refund - ${transaction.invoice_number}`,
                      reference_number: transaction.invoice_number,
                      cashier_id: cashierId,
                    });
                  } else {
                    // Customer pays additional - record cash received
                    await db.createCashMovement({
                      movement_type: 'CASH_IN',
                      amount: difference,
                      description: `Exchange additional payment - ${transaction.invoice_number}`,
                      reference_number: transaction.invoice_number,
                      cashier_id: cashierId,
                    });
                  }
                }
              }

              // Prepare data for complete dialog
              const isCreditTx = transaction.payment_method === 'CHARGE_INVOICE';
              setCompleteData({
                transactionType: 'EXCHANGE',
                referenceNumber: returnResult.returnNumber,
                originalInvoice: transaction.invoice_number,
                customerName: transaction.customer_name,
                totalAmount: calculateReturnTotal(),
                reason: exchangeReason.trim(),
                items: selectedReturns.map(item => ({
                  name: item.product_name,
                  quantity: item.return_quantity,
                  unitPrice: item.unit_price,
                  totalAmount: item.unit_price * item.return_quantity,
                })),
                newItems: newItems.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: item.price,
                  totalAmount: item.price * item.quantity,
                })),
                difference: difference,
                isCreditTransaction: isCreditTx,
                refundMethod: 'EXCHANGE',
                cashierName: cashierName,
                transactionDate: new Date(),
              });
              setShowCompleteDialog(true);
              onSuccess?.();
            } catch (error) {
              console.error('Error processing exchange:', error);
              Alert.alert('Error', 'Failed to process exchange');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setTransaction(null);
    setReturnItems([]);
    setNewItems([]);
    setExchangeReason('');
    setProductSearch('');
    setProducts([]);
    setStep('search');
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

  return (
    <>
    <Modal visible={visible && !showCompleteDialog} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { maxWidth: lo.modalMaxWidth }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontSize: fs.h2 }]}>Exchange Item</Text>
            <IconButton icon="close" size={24} iconColor="#FFF" onPress={handleClose} />
          </View>

          <ScrollView style={[styles.content, { padding: sp.md }]}>
            {step === 'search' && (
              <View style={styles.pickerContainer}>
                <POSInvoiceListPicker
                  onSelectInvoice={handleSelectInvoice}
                  onSearchInvoice={handleSearchInvoice}
                  isSearching={isSearching}
                  accentColor="#2196F3"
                  excludeWithReturns={true}
                />
              </View>
            )}

            {(step === 'select_returns' || step === 'add_new') && transaction && (
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

                <View style={styles.infoBox}>
                  <Text style={styles.invoiceLabel}>{transaction.invoice_number}</Text>
                  <Text style={styles.customerLabel}>{transaction.customer_name || 'Walk-in'}</Text>
                </View>

                {/* Return Items */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Items to Return</Text>
                  {returnItems.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <Checkbox
                        status={item.selected ? 'checked' : 'unchecked'}
                        onPress={() => toggleReturnItem(index)}
                        color="#2196F3"
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <Text style={styles.itemPrice}>{formatCurrency(item.unit_price)}</Text>
                      </View>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateReturnQuantity(index, item.return_quantity - 1)}>
                          <Text style={styles.qtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{item.return_quantity}/{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateReturnQuantity(index, item.return_quantity + 1)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Return Value</Text>
                    <Text style={styles.subtotalValue}>{formatCurrency(calculateReturnTotal())}</Text>
                  </View>
                </View>

                {/* New Items */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Replacement Items</Text>
                  <View style={styles.productSearchWrapper}>
                    <TextInput
                      style={styles.productSearchInput}
                      value={productSearch}
                      onChangeText={setProductSearch}
                      placeholder="Search products to add..."
                      placeholderTextColor="#9E9E9E"
                    />
                    {productSearch.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearSearchBtn}
                        onPress={() => setProductSearch('')}
                      >
                        <Text style={styles.clearSearchText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {isSearchingProducts && <ActivityIndicator size="small" style={{ marginVertical: 10 }} />}
                  {products.length > 0 && (
                    <View style={styles.productResults}>
                      {products.slice(0, 5).map(product => (
                        <TouchableOpacity key={product.id} style={styles.productItem} onPress={() => addNewItem(product)}>
                          <Text style={styles.productItemName}>{product.name}</Text>
                          <Text style={styles.productItemPrice}>{formatCurrency(product.price)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {newItems.map(item => (
                    <View key={item.id} style={styles.newItemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                      </View>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateNewItemQty(item.id, -1)}>
                          <Text style={styles.qtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateNewItemQty(item.id, 1)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => removeNewItem(item.id)}>
                        <Text style={styles.removeBtn}>X</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>New Items Value</Text>
                    <Text style={styles.subtotalValue}>{formatCurrency(calculateNewTotal())}</Text>
                  </View>
                </View>

                {/* Difference */}
                <View style={[styles.differenceBox, calculateDifference() > 0 ? styles.diffPositive : calculateDifference() < 0 ? styles.diffNegative : styles.diffZero]}>
                  <Text style={styles.diffLabel}>
                    {(() => {
                      const diff = calculateDifference();
                      const isCreditTx = transaction?.payment_method === 'CHARGE_INVOICE';
                      if (diff === 0) return 'Even Exchange';
                      if (isCreditTx) {
                        return diff > 0 ? 'Balance Increases:' : 'Balance Reduced By:';
                      }
                      return diff > 0 ? 'Customer Pays:' : 'Customer Receives:';
                    })()}
                  </Text>
                  <Text style={styles.diffValue}>{formatCurrency(Math.abs(calculateDifference()))}</Text>
                </View>

                {/* Reason */}
                <View style={styles.section}>
                  <Text style={styles.label}>Exchange Reason *</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={exchangeReason}
                    onChangeText={setExchangeReason}
                    placeholder="e.g., Damaged, Wrong size"
                    placeholderTextColor="#9E9E9E"
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={transaction ? () => { setTransaction(null); setStep('search'); setReturnItems([]); setNewItems([]); } : handleClose}
              disabled={isProcessing}
            >
              <Text style={styles.cancelBtnText}>
                {transaction ? 'Back' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            {transaction && (
              <TouchableOpacity
                style={[styles.exchangeBtn, isProcessing && styles.exchangeBtnDisabled]}
                onPress={handleExchange}
                disabled={isProcessing}
              >
                <Text style={[styles.exchangeBtnText, { fontSize: fs.button }]}>{isProcessing ? 'Processing...' : 'Process Exchange'}</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  container: { backgroundColor: '#FFF', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 20, paddingRight: 8, paddingVertical: 12, backgroundColor: '#2196F3', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  content: { padding: 16 },
  pickerContainer: { minHeight: 450 },
  searchBox: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#616161', marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, backgroundColor: '#FAFAFA' },
  searchBtn: { backgroundColor: '#6200EE', paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
  searchBtnText: { color: '#FFF', fontWeight: '600' },
  infoBox: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginBottom: 16 },
  invoiceLabel: { fontSize: 16, fontWeight: '700', color: '#1565C0' },
  customerLabel: { fontSize: 13, color: '#42A5F5' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#424242', marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  itemInfo: { flex: 1, marginLeft: 8 },
  itemName: { fontSize: 14, fontWeight: '500', color: '#212121' },
  itemPrice: { fontSize: 12, color: '#757575' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '600', color: '#424242' },
  qtyValue: { fontSize: 14, fontWeight: '600', minWidth: 36, textAlign: 'center' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  subtotalLabel: { fontSize: 14, fontWeight: '600', color: '#424242' },
  subtotalValue: { fontSize: 14, fontWeight: '700', color: '#1565C0' },
  productSearchWrapper: { position: 'relative', marginBottom: 8 },
  productSearchInput: { fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, paddingRight: 36, backgroundColor: '#FAFAFA' },
  clearSearchBtn: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', width: 28 },
  clearSearchText: { fontSize: 20, color: '#757575', fontWeight: '600' },
  productResults: { backgroundColor: '#F5F5F5', borderRadius: 8, marginBottom: 10 },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  productItemName: { fontSize: 14, color: '#212121' },
  productItemPrice: { fontSize: 14, fontWeight: '600', color: '#2E7D32' },
  newItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  removeBtn: { color: '#D32F2F', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  differenceBox: { padding: 16, borderRadius: 8, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diffPositive: { backgroundColor: '#FFEBEE' },
  diffNegative: { backgroundColor: '#E8F5E9' },
  diffZero: { backgroundColor: '#F5F5F5' },
  diffLabel: { fontSize: 16, fontWeight: '600' },
  diffValue: { fontSize: 22, fontWeight: '700' },
  reasonInput: { fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, backgroundColor: '#FAFAFA' },
  footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#757575' },
  exchangeBtn: { flex: 2, paddingVertical: 14, borderRadius: 8, backgroundColor: '#2196F3', alignItems: 'center' },
  exchangeBtnDisabled: { backgroundColor: '#90CAF9' },
  exchangeBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
